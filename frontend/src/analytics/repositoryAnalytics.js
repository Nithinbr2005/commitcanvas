/**
 * repositoryAnalytics.js
 *
 * Pure JS analytics engine — no React, no JSX.
 * Derives verifiable facts from the normalized parsedData object.
 *
 * All analytics operate on the ACTUAL loaded dataset.
 * Nothing is inferred or invented beyond what raw Git data provides.
 */

/**
 * Returns the ISO week key "YYYY-Www" for a Unix timestamp.
 */
function isoWeekKey(ts) {
  const d = new Date(ts * 1000)
  // ISO week: Monday-based
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * Computes the median of an array of numbers.
 * Returns 0 for empty arrays.
 */
function median(arr) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Main analytics function.
 *
 * @param {object} parsedData  — normalized repository data from normalizeGitData()
 * @returns {object}           — analytics facts object
 */
export function analyzeRepository(parsedData) {
  if (!parsedData || !Array.isArray(parsedData.commits) || parsedData.commits.length === 0) {
    return null
  }

  const commits = [...parsedData.commits].sort((a, b) => a.timestamp - b.timestamp)
  const branches = parsedData.branches || []
  const contributors = parsedData.contributors || []

  // ── Basic facts ─────────────────────────────────────────────────────────────
  const firstCommit = commits[0]
  const latestCommit = commits[commits.length - 1]
  const commitCount = commits.length

  // ── Repository age (available history span) ─────────────────────────────────
  const repoAgeInDays = commits.length >= 2
    ? Math.round((latestCommit.timestamp - firstCommit.timestamp) / 86400)
    : 0

  // ── Contributor activity ─────────────────────────────────────────────────────
  // Build: authorKey → { authorName, commits[], firstTimestamp, lastTimestamp }
  const contributorMap = new Map()
  for (const c of commits) {
    const key = c.authorLogin || c.authorName || 'Unknown'
    if (!contributorMap.has(key)) {
      contributorMap.set(key, {
        authorName: c.authorName || key,
        authorLogin: key,
        commits: [],
        firstTimestamp: c.timestamp,
        lastTimestamp: c.timestamp,
      })
    }
    const entry = contributorMap.get(key)
    entry.commits.push(c)
    entry.firstTimestamp = Math.min(entry.firstTimestamp, c.timestamp)
    entry.lastTimestamp  = Math.max(entry.lastTimestamp,  c.timestamp)
  }
  const contributorActivity = [...contributorMap.values()]

  // ── First contributor (author of firstCommit) ────────────────────────────────
  const firstContributorKey = firstCommit.authorLogin || firstCommit.authorName || 'Unknown'

  // ── Merge commits ────────────────────────────────────────────────────────────
  // Rely ONLY on isMerge from normalizeGitData (multiple parents), never on message
  const mergeCommits = commits.filter(c => c.isMerge === true)

  // ── Commits bucketed by ISO week ─────────────────────────────────────────────
  const weekBuckets = new Map() // weekKey → commit[]
  for (const c of commits) {
    const wk = isoWeekKey(c.timestamp)
    if (!weekBuckets.has(wk)) weekBuckets.set(wk, [])
    weekBuckets.get(wk).push(c)
  }

  // ── Activity peaks ────────────────────────────────────────────────────────────
  // Only consider weeks that actually have commits (ignore empty weeks for baseline)
  const activeWeekCounts = [...weekBuckets.values()].map(wc => wc.length)
  const activeMedian = median(activeWeekCounts)

  // Peak threshold: > 2× median of active weeks AND at least 3 commits
  const PEAK_MIN_COMMITS = 3
  const activityPeaks = []
  for (const [weekKey, weekCommits] of weekBuckets) {
    const count = weekCommits.length
    if (count >= PEAK_MIN_COMMITS && count > 2 * activeMedian && activeMedian > 0) {
      activityPeaks.push({
        weekKey,
        commitCount: count,
        commits: weekCommits,
        // Representative commit: latest in the week
        representativeCommit: weekCommits[weekCommits.length - 1],
        startTs: weekCommits[0].timestamp,
        endTs:   weekCommits[weekCommits.length - 1].timestamp,
      })
    }
  }
  // Sort by time
  activityPeaks.sort((a, b) => a.startTs - b.startTs)

  // ── Inactivity gaps ───────────────────────────────────────────────────────────
  const INACTIVITY_THRESHOLD_DAYS = 14
  const inactivityGaps = []
  for (let i = 1; i < commits.length; i++) {
    const gapSecs = commits[i].timestamp - commits[i - 1].timestamp
    const gapDays = gapSecs / 86400
    if (gapDays >= INACTIVITY_THRESHOLD_DAYS) {
      inactivityGaps.push({
        gapDays: Math.round(gapDays),
        previousCommit: commits[i - 1],
        nextCommit:     commits[i],
        startTs: commits[i - 1].timestamp,
        endTs:   commits[i].timestamp,
      })
    }
  }

  // ── Large-change commits ──────────────────────────────────────────────────────
  // Only when actual file data is present. Skip if files array missing/empty.
  // To keep the timeline clean, cap at top-3 by file count.
  const LARGE_CHANGE_MIN_FILES = 10
  const commitsWithFiles = commits.filter(c => Array.isArray(c.files) && c.files.length >= LARGE_CHANGE_MIN_FILES)
  // Sort descending by file count
  const largeChangeCommits = commitsWithFiles
    .sort((a, b) => b.files.length - a.files.length)
    .slice(0, 3)

  // ── Commits by month (for summary display) ────────────────────────────────────
  const monthBuckets = new Map()
  for (const c of commits) {
    const d = new Date(c.timestamp * 1000)
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthBuckets.has(mk)) monthBuckets.set(mk, [])
    monthBuckets.get(mk).push(c)
  }

  return {
    // Raw inputs (for storyGenerator access)
    commits,
    branches,

    // Core facts
    firstCommit,
    latestCommit,
    commitCount,
    repoAgeInDays,

    // Contributor facts
    contributorActivity,
    contributorCount: contributorMap.size,
    firstContributorKey,

    // Merge facts
    mergeCommits,

    // Weekly / monthly buckets
    weekBuckets,
    monthBuckets,

    // Peaks / gaps
    activityPeaks,
    inactivityGaps,

    // Large change
    largeChangeCommits,

    // Median active-week commit count (for context)
    activeMedian,
  }
}

/**
 * analyzeFiles()
 *
 * Builds a ranked file-evolution map from the actual commit file arrays.
 * Only runs on commits that have a populated files array.
 * Returns null when no file data is available at all.
 *
 * @param {object} parsedData — normalized repository data
 * @returns {object|null}
 */
export function analyzeFiles(parsedData) {
  if (!parsedData || !Array.isArray(parsedData.commits)) return null

  const commits = [...parsedData.commits].sort((a, b) => a.timestamp - b.timestamp)

  // Map: normalizedFilename → { filename, events: [{commit, status}], touchCount }
  const fileMap = new Map()
  let totalFileEvents = 0

  for (const commit of commits) {
    if (!Array.isArray(commit.files) || commit.files.length === 0) continue

    for (const f of commit.files) {
      const name = f.filename || f.path || f
      if (!name || typeof name !== 'string') continue

      const status = resolveFileStatus(f)

      if (!fileMap.has(name)) {
        fileMap.set(name, { filename: name, events: [], touchCount: 0 })
      }
      const entry = fileMap.get(name)
      entry.events.push({ commit, status })
      entry.touchCount++
      totalFileEvents++
    }
  }

  if (fileMap.size === 0) return null

  // Sort files by touch count descending
  const files = [...fileMap.values()].sort((a, b) => b.touchCount - a.touchCount)

  // Derive extension breakdown
  const extMap = new Map()
  for (const file of files) {
    const ext = getExtension(file.filename)
    extMap.set(ext, (extMap.get(ext) || 0) + file.touchCount)
  }
  const extensionBreakdown = [...extMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ext, count]) => ({ ext, count }))

  // Commits that have any file data
  const commitsWithFiles = commits.filter(c => Array.isArray(c.files) && c.files.length > 0)

  return {
    files,          // all files, ranked by touchCount
    topFiles: files.slice(0, 20),  // limit for UI
    fileCount: fileMap.size,
    totalFileEvents,
    extensionBreakdown,
    commitsWithFiles,
    hasFileData: true,
  }
}

/** Normalise the status field from various API shapes */
function resolveFileStatus(f) {
  if (f.status === 'added'   || f.change === 'A') return 'added'
  if (f.status === 'removed' || f.change === 'D') return 'removed'
  return 'modified'
}

/** Extract file extension (lowercase, with dot), or 'other' */
function getExtension(filename) {
  if (!filename) return 'other'
  const parts = filename.split('.')
  if (parts.length < 2) return 'other'
  return '.' + parts[parts.length - 1].toLowerCase()
}

