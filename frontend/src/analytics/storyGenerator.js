/**
 * storyGenerator.js
 *
 * Pure JS story generator — no React, no JSX.
 * Transforms analytics facts into an ordered array of story milestones.
 *
 * Rules:
 * - Only use real data; never invent feature names, intentions, or claims.
 * - Descriptions are factual summaries of what the data shows.
 * - Maximum ~15 milestones for a clean, readable timeline.
 * - Milestones are ordered chronologically.
 */

/**
 * Format a Unix timestamp as a human-readable date string.
 */
function fmtDate(ts, opts = { month: 'long', year: 'numeric' }) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', opts)
}

function fmtDateFull(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })
}

/**
 * Returns true if two activity peaks are "close" (same or adjacent week).
 * Used for grouping.
 */
function peaksAreClose(peakA, peakB) {
  const diffDays = Math.abs(peakA.endTs - peakB.startTs) / 86400
  return diffDays < 21 // within 3 weeks
}

/**
 * Merge adjacent/overlapping peaks into a single grouped peak.
 */
function groupPeaks(peaks) {
  if (!peaks.length) return []
  const groups = []
  let current = { ...peaks[0] }

  for (let i = 1; i < peaks.length; i++) {
    if (peaksAreClose(current, peaks[i])) {
      // Merge: extend time range, aggregate commits
      current.commits = [...current.commits, ...peaks[i].commits]
      current.commitCount = current.commits.length
      current.endTs = peaks[i].endTs
      current.representativeCommit = peaks[i].representativeCommit
    } else {
      groups.push(current)
      current = { ...peaks[i] }
    }
  }
  groups.push(current)
  return groups
}

/**
 * Deduplicate milestones that would target the same SHA too close together.
 * Prevents "large_change" and "major_merge" on the same commit appearing twice.
 * EXCEPTION: current_state is never removed — it must always end the timeline.
 */
function deduplicateBySha(milestones) {
  const seenShas = new Set()
  return milestones.filter(m => {
    if (m.type === 'current_state') return true  // always keep — guaranteed last
    if (!m.commitSha) return true                // null SHA (inactivity) always passes
    if (seenShas.has(m.commitSha)) return false
    seenShas.add(m.commitSha)
    return true
  })
}

/**
 * Generate story milestones from analytics facts.
 *
 * @param {object} analytics  — output of analyzeRepository()
 * @param {object} options    — { owner, repo }
 * @returns {object[]}        — array of milestone objects, chronologically ordered
 */
export function generateStory(analytics, options = {}) {
  if (!analytics) return []

  const {
    firstCommit,
    latestCommit,
    commitCount,
    repoAgeInDays,
    contributorActivity,
    contributorCount,
    firstContributorKey,
    mergeCommits,
    activityPeaks,
    inactivityGaps,
    largeChangeCommits,
    branches,
  } = analytics

  // Accumulate milestone candidates (unsorted)
  const candidates = []

  // ── 1. PROJECT BEGINS ────────────────────────────────────────────────────────
  candidates.push({
    id: 'project_begins',
    type: 'project_begins',
    icon: '●',
    label: 'Project Begins',
    date: fmtDateFull(firstCommit.timestamp),
    sortTs: firstCommit.timestamp,
    description:
      `The earliest available commit appears on ${fmtDateFull(firstCommit.timestamp)}, ` +
      `authored by ${firstCommit.authorName || 'Unknown'}.`,
    commitSha: firstCommit.sha,
    commitShas: [firstCommit.sha],
    meta: { authorName: firstCommit.authorName },
  })

  // ── 2. NEW CONTRIBUTORS ─────────────────────────────────────────────────────
  // Skip the first contributor (already covered by Project Begins).
  // Only create milestones for contributors whose first commit appears AFTER the first commit.
  const additionalContributors = contributorActivity
    .filter(ca => {
      // Exclude the initial contributor
      if (ca.authorLogin === firstContributorKey) return false
      // Must have a first commit strictly after firstCommit
      return ca.firstTimestamp > firstCommit.timestamp
    })
    .sort((a, b) => a.firstTimestamp - b.firstTimestamp)

  for (const ca of additionalContributors) {
    const firstC = ca.commits.find(c => c.timestamp === ca.firstTimestamp) || ca.commits[0]
    candidates.push({
      id: `contributor_${ca.authorLogin}`,
      type: 'new_contributor',
      icon: '👤',
      label: 'New Contributor',
      date: fmtDate(ca.firstTimestamp, { month: 'long', year: 'numeric' }),
      sortTs: ca.firstTimestamp,
      description:
        `${ca.authorName} made their first recorded commit on ${fmtDateFull(ca.firstTimestamp)}.`,
      commitSha: firstC?.sha || null,
      commitShas: firstC?.sha ? [firstC.sha] : [],
      meta: { authorName: ca.authorName, totalCommits: ca.commits.length },
    })
  }

  // ── 3. ACTIVITY PEAKS ───────────────────────────────────────────────────────
  const grouped = groupPeaks(activityPeaks)
  // Cap at 3 peak milestones for timeline density
  const topPeaks = grouped
    .sort((a, b) => b.commitCount - a.commitCount)
    .slice(0, 3)
    .sort((a, b) => a.startTs - b.startTs)

  for (const peak of topPeaks) {
    const rep = peak.representativeCommit
    candidates.push({
      id: `peak_${peak.weekKey || peak.startTs}`,
      type: 'activity_peak',
      icon: '◆',
      label: 'Development Accelerates',
      date: fmtDate(peak.startTs, { month: 'long', year: 'numeric' }),
      sortTs: peak.startTs,
      description:
        `${peak.commitCount} commits were recorded during this period, ` +
        `making it one of the most active stretches in the loaded history. ` +
        `${[...new Set(peak.commits.map(c => c.authorName))].length} contributor(s) were active.`,
      commitSha: rep?.sha || null,
      commitShas: peak.commits.map(c => c.sha),
      meta: {
        commitCount: peak.commitCount,
        contributors: [...new Set(peak.commits.map(c => c.authorName))],
        startTs: peak.startTs,
        endTs: peak.endTs,
      },
    })
  }

  // ── 4. MERGE COMMITS ────────────────────────────────────────────────────────
  // Cap at 4 significant merge events to keep the timeline clean.
  // Prefer merges with the most files changed; fall back to chronological order.
  const sortedMerges = [...mergeCommits].sort((a, b) => {
    const aFiles = Array.isArray(a.files) ? a.files.length : 0
    const bFiles = Array.isArray(b.files) ? b.files.length : 0
    return bFiles - aFiles
  })
  const topMerges = sortedMerges.slice(0, 4).sort((a, b) => a.timestamp - b.timestamp)

  for (const mc of topMerges) {
    const filesCount = Array.isArray(mc.files) ? mc.files.length : null
    const filesNote = filesCount !== null ? ` ${filesCount} file(s) were affected.` : ''
    candidates.push({
      id: `merge_${mc.sha}`,
      type: 'major_merge',
      icon: '⑂',
      label: 'Merge Commit',
      date: fmtDateFull(mc.timestamp),
      sortTs: mc.timestamp,
      description:
        `A merge commit with ${mc.parents?.length || 2} parent(s) was recorded on ${fmtDateFull(mc.timestamp)}, ` +
        `authored by ${mc.authorName || 'Unknown'}.${filesNote}`,
      commitSha: mc.sha,
      commitShas: [mc.sha],
      meta: {
        parentCount: mc.parents?.length || 2,
        filesCount,
        authorName: mc.authorName,
      },
    })
  }

  // ── 5. INACTIVITY GAPS ──────────────────────────────────────────────────────
  // Cap at 2 most significant (longest) gaps.
  const topGaps = [...inactivityGaps]
    .sort((a, b) => b.gapDays - a.gapDays)
    .slice(0, 2)
    .sort((a, b) => a.startTs - b.startTs)

  for (const gap of topGaps) {
    candidates.push({
      id: `gap_${gap.startTs}`,
      type: 'inactivity',
      icon: '⏸',
      label: 'Development Pause',
      date: fmtDate(gap.startTs, { month: 'long', year: 'numeric' }),
      sortTs: gap.startTs,
      description:
        `No commits were recorded for approximately ${gap.gapDays} day(s), ` +
        `between ${fmtDateFull(gap.startTs)} and ${fmtDateFull(gap.endTs)}.`,
      commitSha: null,   // No commit represents a gap
      commitShas: [],
      meta: {
        gapDays: gap.gapDays,
        previousCommitSha: gap.previousCommit?.sha || null,
        nextCommitSha:     gap.nextCommit?.sha || null,
        startTs: gap.startTs,
        endTs:   gap.endTs,
      },
    })
  }

  // ── 6. LARGE CHANGE COMMITS ─────────────────────────────────────────────────
  // Only when actual file data exists (checked in analytics layer).
  for (const lc of largeChangeCommits) {
    const filesCount = lc.files.length
    candidates.push({
      id: `large_${lc.sha}`,
      type: 'large_change',
      icon: '📦',
      label: 'Large Change Set',
      date: fmtDateFull(lc.timestamp),
      sortTs: lc.timestamp,
      description:
        `This commit affected ${filesCount} file(s) in the loaded history, ` +
        `one of the largest single-commit change sets recorded. ` +
        `Authored by ${lc.authorName || 'Unknown'} on ${fmtDateFull(lc.timestamp)}.`,
      commitSha: lc.sha,
      commitShas: [lc.sha],
      meta: { filesCount, authorName: lc.authorName },
    })
  }

  // ── 7. CURRENT STATE ────────────────────────────────────────────────────────
  const defaultBranch = (branches || []).find(b => b.name === 'main' || b.name === 'master')?.name || 'main'
  candidates.push({
    id: 'current_state',
    type: 'current_state',
    icon: '💠',
    label: 'Current State',
    date: fmtDateFull(latestCommit.timestamp),
    sortTs: latestCommit.timestamp + 1, // guaranteed to sort last
    description:
      `This is the latest state represented by the loaded repository history. ` +
      `The repository has ${commitCount} commit(s), ` +
      `${contributorCount} contributor(s), ` +
      `${(branches || []).length} branch(es), ` +
      `and ${repoAgeInDays > 0 ? `${repoAgeInDays} days` : 'a single day'} of recorded history.`,
    commitSha: latestCommit.sha,
    commitShas: [latestCommit.sha],
    meta: {
      commitCount,
      contributorCount,
      branchCount: (branches || []).length,
      repoAgeInDays,
      latestCommitSha: latestCommit.sha,
      latestCommitSha7: latestCommit.sha.slice(0, 7),
    },
  })

  // ── Sort chronologically ─────────────────────────────────────────────────────
  const sorted = candidates.sort((a, b) => a.sortTs - b.sortTs)

  // ── Deduplicate by SHA (prevent same commit appearing in two milestone types) ─
  const deduped = deduplicateBySha(sorted)

  return deduped
}
