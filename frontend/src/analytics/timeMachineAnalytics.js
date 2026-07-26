/**
 * timeMachineAnalytics.js
 *
 * Pure JavaScript analytics engine for Repository Time Machine.
 * No React. No JSX.
 * All historical calculations are derived strictly using commits up to the selected timestamp.
 */

import { analyzeRepository } from './repositoryAnalytics'
import { generateStory } from './storyGenerator'
import { analyzeFileEvolution } from './fileAnalytics'

function getDirectory(filepath) {
  if (!filepath || typeof filepath !== 'string') return 'root'
  const idx = filepath.lastIndexOf('/')
  return idx > 0 ? filepath.substring(0, idx) : 'root'
}

/**
 * buildRepositoryTimeline(parsedData)
 * Returns sorted commits, timestamp bounds, and clean event markers for the time slider.
 */
export function buildRepositoryTimeline(parsedData) {
  if (!parsedData || !Array.isArray(parsedData.commits) || parsedData.commits.length === 0) {
    return { commits: [], minTs: 0, maxTs: 0, totalSpanDays: 0, eventMarkers: [] }
  }

  const sortedCommits = [...parsedData.commits].sort((a, b) => a.timestamp - b.timestamp)
  const minTs = sortedCommits[0].timestamp
  const maxTs = sortedCommits[sortedCommits.length - 1].timestamp
  const totalSpanDays = Math.max(0, Math.ceil((maxTs - minTs) / 86400))

  // Build clean event markers for the timeline
  const rawMarkers = []
  const seenAuthors = new Set()

  // First author of the first commit does NOT get a "Contributor Joined" marker
  if (sortedCommits[0].authorLogin || sortedCommits[0].authorName) {
    seenAuthors.add(sortedCommits[0].authorLogin || sortedCommits[0].authorName)
  }

  // 1. Project Begins marker
  rawMarkers.push({
    id: `event_start_${sortedCommits[0].sha}`,
    type: 'start',
    icon: '🌱',
    label: 'Project Begins',
    timestamp: minTs,
    commitSha: sortedCommits[0].sha,
    description: `First recorded commit by ${sortedCommits[0].authorName}`,
  })

  for (let i = 1; i < sortedCommits.length; i++) {
    const c = sortedCommits[i]
    const authorKey = c.authorLogin || c.authorName || 'Unknown'

    // 2. Contributor Joined marker (only for ADDITIONAL contributors after author #1)
    if (!seenAuthors.has(authorKey)) {
      seenAuthors.add(authorKey)
      rawMarkers.push({
        id: `event_contrib_${c.sha}`,
        type: 'contributor',
        icon: '👤',
        label: `${c.authorName} Joined`,
        timestamp: c.timestamp,
        commitSha: c.sha,
        description: `${c.authorName} made their first recorded contribution`,
      })
    }

    // 3. Merge marker
    if (c.isMerge) {
      rawMarkers.push({
        id: `event_merge_${c.sha}`,
        type: 'merge',
        icon: '⑂',
        label: 'Merge Commit',
        timestamp: c.timestamp,
        commitSha: c.sha,
        description: `Merge commit ${c.sha.slice(0, 7)} by ${c.authorName}`,
      })
    }

    // 4. Large Change marker
    if (Array.isArray(c.files) && c.files.length >= 10) {
      rawMarkers.push({
        id: `event_large_${c.sha}`,
        type: 'large_change',
        icon: '📦',
        label: 'Large Change Set',
        timestamp: c.timestamp,
        commitSha: c.sha,
        description: `Commit ${c.sha.slice(0, 7)} affected ${c.files.length} observed files`,
      })
    }
  }

  // Deduplicate and cap event markers to keep timeline readable
  const deduplicated = []
  let lastTs = -Infinity
  for (const m of rawMarkers) {
    // Keep markers separated by at least 1% of total span or 86400s
    if (m.type === 'start' || (m.timestamp - lastTs) >= Math.max(86400, (maxTs - minTs) * 0.03)) {
      deduplicated.push(m)
      lastTs = m.timestamp
    }
  }

  return {
    commits: sortedCommits,
    minTs,
    maxTs,
    totalSpanDays,
    eventMarkers: deduplicated.slice(0, 12), // Limit density to max 12 markers
  }
}

/**
 * getSnapshotAtTime(parsedData, timestamp)
 * Computes historical repository snapshot using ONLY commits on/before timestamp.
 */
export function getSnapshotAtTime(parsedData, timestamp) {
  const { commits, minTs } = buildRepositoryTimeline(parsedData)
  if (commits.length === 0) return null

  // Filter commits strictly on or before selected timestamp
  const commitsUpToTime = commits.filter(c => c.timestamp <= timestamp)
  const isBeforeStart = commitsUpToTime.length === 0

  // If before first commit, fallback to first commit boundary safely
  const effectiveCommits = isBeforeStart ? [commits[0]] : commitsUpToTime
  const latestCommit = effectiveCommits[effectiveCommits.length - 1]

  const contributorsSet = new Set()
  const filesSet = new Set()
  const dirsSet = new Set()
  const authorCounts = new Map()
  const dirCounts = new Map()
  let mergesCount = 0

  for (const c of effectiveCommits) {
    const author = c.authorName || 'Unknown'
    contributorsSet.add(author)
    authorCounts.set(author, (authorCounts.get(author) || 0) + 1)

    if (c.isMerge) mergesCount++

    if (Array.isArray(c.files)) {
      for (const f of c.files) {
        const name = f.filename || f.path || (typeof f === 'string' ? f : null)
        if (!name) continue
        filesSet.add(name)

        const dir = getDirectory(name)
        dirsSet.add(dir)
        dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1)
      }
    }
  }

  // Find most active contributor and directory up to this point
  let mostActiveContributor = 'None'
  let maxAuthorCommits = 0
  for (const [author, count] of authorCounts.entries()) {
    if (count > maxAuthorCommits) {
      maxAuthorCommits = count
      mostActiveContributor = author
    }
  }

  let mostActiveDirectory = 'root'
  let maxDirTouches = 0
  for (const [dir, count] of dirCounts.entries()) {
    if (count > maxDirTouches) {
      maxDirTouches = count
      mostActiveDirectory = dir
    }
  }

  const historyAgeDays = isBeforeStart ? 0 : Math.max(0, Math.floor((timestamp - minTs) / 86400))

  return {
    timestamp,
    commitsCount: isBeforeStart ? 0 : effectiveCommits.length,
    contributorsCount: isBeforeStart ? 0 : contributorsSet.size,
    observedFilesCount: isBeforeStart ? 0 : filesSet.size,
    directoriesCount: isBeforeStart ? 0 : dirsSet.size,
    mergesCount: isBeforeStart ? 0 : mergesCount,
    historyAgeDays,
    latestCommit: isBeforeStart ? null : latestCommit,
    mostActiveContributor,
    mostActiveDirectory,
    isBeforeStart,
  }
}

/**
 * getContributorStateAtTime(parsedData, timestamp)
 * Returns active contributors up to timestamp with commit counts & percentage so far.
 */
export function getContributorStateAtTime(parsedData, timestamp) {
  const { commits } = buildRepositoryTimeline(parsedData)
  const commitsUpToTime = commits.filter(c => c.timestamp <= timestamp)
  if (commitsUpToTime.length === 0) return []

  const stats = new Map() // author -> { authorName, avatarUrl, count, firstTs }

  for (const c of commitsUpToTime) {
    const name = c.authorName || 'Unknown'
    if (!stats.has(name)) {
      stats.set(name, {
        authorName: name,
        authorLogin: c.authorLogin || name,
        avatarUrl: c.avatarUrl,
        count: 0,
        firstTs: c.timestamp,
      })
    }
    const entry = stats.get(name)
    entry.count++
  }

  const totalCommitsSoFar = commitsUpToTime.length
  return [...stats.values()]
    .map(c => ({
      ...c,
      percentage: totalCommitsSoFar > 0 ? Math.round((c.count / totalCommitsSoFar) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * getFileStateAtTime(parsedData, timestamp)
 * Returns file & directory state inferred from history up to timestamp.
 */
export function getFileStateAtTime(parsedData, timestamp) {
  const { commits } = buildRepositoryTimeline(parsedData)
  const commitsUpToTime = commits.filter(c => c.timestamp <= timestamp)
  if (commitsUpToTime.length === 0) return { observedFiles: [], mostTouchedFile: null, recentlyChangedFiles: [] }

  const fileMap = new Map()
  for (const c of commitsUpToTime) {
    if (!Array.isArray(c.files)) continue
    for (const f of c.files) {
      const name = f.filename || f.path || (typeof f === 'string' ? f : null)
      if (!name) continue

      if (!fileMap.has(name)) {
        fileMap.set(name, {
          filename: name,
          directory: getDirectory(name),
          touchCount: 0,
          latestTs: c.timestamp,
          latestCommit: c,
        })
      }
      const entry = fileMap.get(name)
      entry.touchCount++
      if (c.timestamp > entry.latestTs) {
        entry.latestTs = c.timestamp
        entry.latestCommit = c
      }
    }
  }

  const observedFiles = [...fileMap.values()]
  const mostTouchedFile = observedFiles.sort((a, b) => b.touchCount - a.touchCount)[0] || null
  const recentlyChangedFiles = [...observedFiles].sort((a, b) => b.latestTs - a.latestTs).slice(0, 10)

  return {
    observedFiles,
    mostTouchedFile,
    recentlyChangedFiles,
  }
}

/**
 * getStorySoFarAtTime(parsedData, timestamp)
 * Reuses storyGenerator output. Marks milestones on/before timestamp as unlocked, and after as locked.
 */
export function getStorySoFarAtTime(parsedData, timestamp) {
  if (!parsedData) return []
  const analytics = analyzeRepository(parsedData)
  if (!analytics) return []

  const allMilestones = generateStory(analytics, { owner: parsedData.owner, repo: parsedData.repo })

  return allMilestones.map(m => {
    // Find timestamp of representative commit if milestone has commitSha
    let milestoneTs = 0
    if (m.commitSha) {
      const c = parsedData.commits.find(commit => commit.sha === m.commitSha)
      if (c) milestoneTs = c.timestamp
    } else if (m.meta?.timestamp) {
      milestoneTs = m.meta.timestamp
    } else {
      milestoneTs = parsedData.commits[0]?.timestamp || 0
    }

    const isUnlocked = milestoneTs <= timestamp
    return {
      ...m,
      unlocked: isUnlocked,
      milestoneTs,
    }
  })
}

/**
 * getComparisonWithLatest(parsedData, timestamp)
 * Compares current snapshot at timestamp with latest HEAD repository snapshot.
 */
export function getComparisonWithLatest(parsedData, timestamp) {
  const { commits, maxTs } = buildRepositoryTimeline(parsedData)
  if (commits.length === 0) return null

  const current = getSnapshotAtTime(parsedData, timestamp)
  const latest = getSnapshotAtTime(parsedData, maxTs)

  return {
    current,
    latest,
    deltas: {
      commits: latest.commitsCount - current.commitsCount,
      contributors: latest.contributorsCount - current.contributorsCount,
      files: latest.observedFilesCount - current.observedFilesCount,
      directories: latest.directoriesCount - current.directoriesCount,
      merges: latest.mergesCount - current.mergesCount,
    }
  }
}
