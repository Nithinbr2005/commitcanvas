/**
 * fileAnalytics.js
 *
 * Pure JavaScript analytics engine for repository file evolution and codebase intelligence.
 * No React. No JSX.
 * Strictly adheres to data accuracy rules: computes metrics only from available normalized metadata.
 */

/** Helper to extract directory path from filename */
function getDirectory(filepath) {
  if (!filepath || typeof filepath !== 'string') return 'root'
  const idx = filepath.lastIndexOf('/')
  return idx > 0 ? filepath.substring(0, idx) : 'root'
}

/** Helper to resolve file status safely */
function resolveStatus(f) {
  if (f.status === 'added' || f.change === 'A') return 'added'
  if (f.status === 'removed' || f.change === 'D') return 'removed'
  return 'modified'
}

/**
 * analyzeFileEvolution(parsedData)
 * Scans commits and builds aggregate file and directory stats.
 */
export function analyzeFileEvolution(parsedData) {
  if (!parsedData || !Array.isArray(parsedData.commits) || parsedData.commits.length === 0) {
    return null
  }

  const commits = [...parsedData.commits].sort((a, b) => a.timestamp - b.timestamp)
  const fileMap = new Map() // filename -> stats
  const dirMap = new Map()  // dirname -> stats
  let totalFileEvents = 0
  let largestCommit = null
  let maxFilesTouched = -1

  for (const commit of commits) {
    const files = commit.files
    if (!Array.isArray(files) || files.length === 0) continue

    if (files.length > maxFilesTouched) {
      maxFilesTouched = files.length
      largestCommit = commit
    }

    const author = commit.authorName || 'Unknown'

    for (const f of files) {
      const name = f.filename || f.path || (typeof f === 'string' ? f : null)
      if (!name) continue

      const status = resolveStatus(f)
      const dir = getDirectory(name)
      const ts = commit.timestamp

      // Update file stats
      if (!fileMap.has(name)) {
        fileMap.set(name, {
          filename: name,
          directory: dir,
          touchCount: 0,
          contributors: new Set(),
          firstTs: ts,
          latestTs: ts,
          firstCommit: commit,
          latestCommit: commit,
          events: [],
          additions: 0,
          deletions: 0,
        })
      }
      const fEntry = fileMap.get(name)
      fEntry.touchCount++
      fEntry.contributors.add(author)
      if (ts < fEntry.firstTs) {
        fEntry.firstTs = ts
        fEntry.firstCommit = commit
      }
      if (ts >= fEntry.latestTs) {
        fEntry.latestTs = ts
        fEntry.latestCommit = commit
      }
      fEntry.events.push({ commit, status, timestamp: ts })
      if (typeof f.additions === 'number') fEntry.additions += f.additions
      if (typeof f.deletions === 'number') fEntry.deletions += f.deletions

      // Update directory stats
      if (!dirMap.has(dir)) {
        dirMap.set(dir, {
          path: dir,
          touchCount: 0,
          files: new Set(),
          contributors: new Set(),
          firstTs: ts,
          latestTs: ts,
        })
      }
      const dEntry = dirMap.get(dir)
      dEntry.touchCount++
      dEntry.files.add(name)
      dEntry.contributors.add(author)
      if (ts < dEntry.firstTs) dEntry.firstTs = ts
      if (ts > dEntry.latestTs) dEntry.latestTs = ts

      totalFileEvents++
    }
  }

  if (fileMap.size === 0) return null

  // Format sets to arrays and sort
  const allFiles = [...fileMap.values()].map(f => ({
    ...f,
    contributors: [...f.contributors],
    contributorCount: f.contributors.size,
  }))

  const allDirs = [...dirMap.values()].map(d => ({
    ...d,
    fileCount: d.files.size,
    files: [...d.files],
    contributors: [...d.contributors],
    contributorCount: d.contributors.size,
  }))

  // Rankings
  const mostChangedFiles = [...allFiles].sort((a, b) => b.touchCount - a.touchCount).slice(0, 15)
  const mostActiveDirectories = [...allDirs].sort((a, b) => b.touchCount - a.touchCount).slice(0, 10)
  const recentlyModifiedFiles = [...allFiles].sort((a, b) => b.latestTs - a.latestTs).slice(0, 15)
  const newestFiles = [...allFiles].sort((a, b) => b.firstTs - a.firstTs).slice(0, 10)
  const oldestFiles = [...allFiles].sort((a, b) => a.firstTs - b.firstTs).slice(0, 10)

  return {
    files: allFiles,
    directories: allDirs,
    mostChangedFiles,
    mostActiveDirectories,
    recentlyModifiedFiles,
    largestChangeCommit: largestCommit,
    newestFiles,
    oldestFiles,
    fileCount: allFiles.length,
    dirCount: allDirs.length,
    totalFileEvents,
  }
}

/**
 * analyzeSingleFile(parsedData, filename)
 * Generates factual evolution timeline and stats for a specific file.
 */
export function analyzeSingleFile(parsedData, filename) {
  const evolution = analyzeFileEvolution(parsedData)
  if (!evolution) return null

  const fileEntry = evolution.files.find(f => f.filename === filename)
  if (!fileEntry) return null

  const events = [...fileEntry.events].sort((a, b) => b.timestamp - a.timestamp)
  const chronological = [...fileEntry.events].sort((a, b) => a.timestamp - b.timestamp)

  // Generate factual milestones without inventing engineering labels
  const milestones = []
  const seenShas = new Set()

  // 1. First appearance in loaded history
  if (chronological.length > 0) {
    const firstEv = chronological[0]
    milestones.push({
      id: `first_${firstEv.commit.sha}`,
      type: 'first_appearance',
      icon: '🌱',
      label: 'FIRST APPEARANCE IN LOADED HISTORY',
      date: new Date(firstEv.timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      timestamp: firstEv.timestamp,
      commit: firstEv.commit,
      description: `File first observed in commit ${firstEv.commit.sha.slice(0, 7)} by ${firstEv.commit.authorName}. Message: "${firstEv.commit.message.split('\n')[0]}"`,
    })
    seenShas.add(firstEv.commit.sha)
  }

  // 2. High-activity / Largest change commit for this file (if additions/deletions available or significant commit)
  let maxChangeEv = null
  let maxMagnitude = -1
  for (const ev of chronological) {
    const filesInCommit = ev.commit.files || []
    const match = filesInCommit.find(f => (f.filename || f.path || f) === filename)
    if (match && typeof match === 'object') {
      const mag = (match.additions || 0) + (match.deletions || 0)
      if (mag > maxMagnitude && !seenShas.has(ev.commit.sha)) {
        maxMagnitude = mag
        maxChangeEv = ev
      }
    }
  }

  if (!maxChangeEv && chronological.length > 2) {
    // Pick middle commit as high activity sample if no magnitude available
    const midIdx = Math.floor(chronological.length / 2)
    if (!seenShas.has(chronological[midIdx].commit.sha)) {
      maxChangeEv = chronological[midIdx]
    }
  }

  if (maxChangeEv) {
    milestones.push({
      id: `high_${maxChangeEv.commit.sha}`,
      type: 'high_activity',
      icon: '⚡',
      label: maxMagnitude > 0 ? 'HIGH-ACTIVITY CHANGE' : 'RECORDED MODIFICATION',
      date: new Date(maxChangeEv.timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      timestamp: maxChangeEv.timestamp,
      commit: maxChangeEv.commit,
      description: `Observed change in commit ${maxChangeEv.commit.sha.slice(0, 7)} by ${maxChangeEv.commit.authorName}.${maxMagnitude > 0 ? ` Magnitude: +${maxChangeEv.commit.files.find(f => (f.filename||f.path) === filename)?.additions || 0} / -${maxChangeEv.commit.files.find(f => (f.filename||f.path) === filename)?.deletions || 0} lines.` : ''}`,
    })
    seenShas.add(maxChangeEv.commit.sha)
  }

  // 3. Latest recorded change
  if (chronological.length > 1) {
    const lastEv = chronological[chronological.length - 1]
    if (!seenShas.has(lastEv.commit.sha)) {
      milestones.push({
        id: `latest_${lastEv.commit.sha}`,
        type: 'latest_change',
        icon: '💠',
        label: 'LATEST RECORDED CHANGE',
        date: new Date(lastEv.timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        timestamp: lastEv.timestamp,
        commit: lastEv.commit,
        description: `Latest modification recorded on ${new Date(lastEv.timestamp * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} in commit ${lastEv.commit.sha.slice(0, 7)} by ${lastEv.commit.authorName}.`,
      })
    }
  }

  // Sort milestones chronologically
  milestones.sort((a, b) => a.timestamp - b.timestamp)

  return {
    ...fileEntry,
    events,
    milestones,
    commits: events.map(e => e.commit),
  }
}

/**
 * generateCodebaseMap(parsedData)
 * Builds an expandable hierarchical tree representing repository directory structure.
 */
export function generateCodebaseMap(parsedData) {
  const evolution = analyzeFileEvolution(parsedData)
  if (!evolution) return null

  const root = { name: 'root', path: '', type: 'dir', touchCount: 0, childrenMap: new Map(), contributors: new Set(), latestTs: 0 }

  for (const file of evolution.files) {
    const parts = file.filename.split('/')
    let current = root
    current.touchCount += file.touchCount
    file.contributors.forEach(c => current.contributors.add(c))
    if (file.latestTs > current.latestTs) current.latestTs = file.latestTs

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const pathSoFar = parts.slice(0, i + 1).join('/')

      if (!current.childrenMap.has(part)) {
        current.childrenMap.set(part, {
          name: part,
          path: pathSoFar,
          type: isFile ? 'file' : 'dir',
          touchCount: 0,
          contributors: new Set(),
          latestTs: 0,
          childrenMap: new Map(),
        })
      }
      const child = current.childrenMap.get(part)
      child.touchCount += file.touchCount
      file.contributors.forEach(c => child.contributors.add(c))
      if (file.latestTs > child.latestTs) child.latestTs = file.latestTs
      current = child
    }
  }

  // Convert maps to sorted arrays recursively
  function formatNode(node) {
    const children = [...node.childrenMap.values()].map(formatNode)
    // Sort directories first, then by touch count descending
    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return b.touchCount - a.touchCount
    })
    return {
      name: node.name,
      path: node.path,
      type: node.type,
      touchCount: node.touchCount,
      contributorCount: node.contributors.size,
      contributors: [...node.contributors],
      latestTs: node.latestTs,
      children: children.length > 0 ? children : undefined,
    }
  }

  return formatNode(root)
}

/**
 * generateDirectoryHeatmap(parsedData)
 * Computes activity tiers (Low, Medium, High) for directories.
 */
export function generateDirectoryHeatmap(parsedData) {
  const evolution = analyzeFileEvolution(parsedData)
  if (!evolution || evolution.directories.length === 0) return null

  const dirs = [...evolution.directories].sort((a, b) => b.touchCount - a.touchCount)
  const maxTouches = dirs[0].touchCount
  const minTouches = dirs[dirs.length - 1].touchCount

  return dirs.map(d => {
    let tier = 'Low'
    if (d.touchCount >= maxTouches * 0.6) tier = 'High'
    else if (d.touchCount >= maxTouches * 0.25) tier = 'Medium'
    return {
      ...d,
      tier,
      intensity: maxTouches > 0 ? d.touchCount / maxTouches : 0,
    }
  })
}

/**
 * generateGrowthCharts(parsedData)
 * Generates time-series datasets for codebase observation charts.
 */
export function generateGrowthCharts(parsedData) {
  const evolution = analyzeFileEvolution(parsedData)
  if (!evolution) return null

  const commits = [...parsedData.commits].sort((a, b) => a.timestamp - b.timestamp)
  if (commits.length === 0) return null

  const firstTs = commits[0].timestamp
  const lastTs = commits[commits.length - 1].timestamp
  const spanDays = Math.max(1, Math.ceil((lastTs - firstTs) / 86400))
  
  // Bucket by month (or week if span < 60 days)
  const isWeekly = spanDays < 60
  const bucketSecs = isWeekly ? 7 * 86400 : 30 * 86400

  const bucketsMap = new Map()
  const seenFiles = new Set()
  const seenContributors = new Set()

  for (const c of commits) {
    const bucketIdx = Math.floor((c.timestamp - firstTs) / bucketSecs)
    const bucketStartTs = firstTs + bucketIdx * bucketSecs
    const dateStr = new Date(bucketStartTs * 1000).toLocaleDateString('en-US', isWeekly ? { month: 'short', day: 'numeric' } : { month: 'short', year: 'numeric' })

    if (!bucketsMap.has(bucketIdx)) {
      bucketsMap.set(bucketIdx, {
        dateStr,
        timestamp: bucketStartTs,
        commitCount: 0,
      })
    }
    const b = bucketsMap.get(bucketIdx)
    b.commitCount++

    if (c.authorLogin) seenContributors.add(c.authorLogin)
    if (Array.isArray(c.files)) {
      c.files.forEach(f => {
        const name = f.filename || f.path || (typeof f === 'string' ? f : null)
        if (name) seenFiles.add(name)
      })
    }
    b.observedFilesCount = seenFiles.size
    b.observedContributorsCount = seenContributors.size
  }

  const sortedBuckets = [...bucketsMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([_, val]) => val)

  return {
    filesOverTime: sortedBuckets.map(b => ({ label: b.dateStr, count: b.observedFilesCount || 0 })),
    contributorsOverTime: sortedBuckets.map(b => ({ label: b.dateStr, count: b.observedContributorsCount || 0 })),
    commitVelocity: sortedBuckets.map(b => ({ label: b.dateStr, count: b.commitCount || 0 })),
    isWeekly,
  }
}

/**
 * generateEngineeringInsights(parsedData)
 * Generates evidence-based observations without making unsupported recommendations.
 */
export function generateEngineeringInsights(parsedData) {
  const evolution = analyzeFileEvolution(parsedData)
  if (!evolution) return []

  const insights = []

  // 1. Most Touched File
  if (evolution.mostChangedFiles.length > 0) {
    const topFile = evolution.mostChangedFiles[0]
    insights.push({
      id: 'most_touched_file',
      title: 'MOST TOUCHED FILE',
      icon: '🔥',
      metric: `${topFile.touchCount} touches`,
      subject: topFile.filename,
      description: `${topFile.filename} appeared in ${topFile.touchCount} commits in the loaded history, making it the most frequently modified file.`,
      targetFile: topFile.filename,
    })
  }

  // 2. Most Active Directory
  if (evolution.mostActiveDirectories.length > 0) {
    const topDir = evolution.mostActiveDirectories[0]
    insights.push({
      id: 'most_active_dir',
      title: 'MOST ACTIVE DIRECTORY',
      icon: '📁',
      metric: `${topDir.touchCount} touches`,
      subject: topDir.path || 'root',
      description: `${topDir.path || 'root'} accounted for the highest number of recorded file touches across ${topDir.fileCount} observed files.`,
      targetDir: topDir.path,
    })
  }

  // 3. Peak File Activity Month/Period
  const growth = generateGrowthCharts(parsedData)
  if (growth && growth.commitVelocity.length > 0) {
    const peak = [...growth.commitVelocity].sort((a, b) => b.count - a.count)[0]
    insights.push({
      id: 'peak_activity',
      title: 'PEAK RECORDED ACTIVITY',
      icon: '📈',
      metric: `${peak.count} commits`,
      subject: peak.label,
      description: `${peak.label} contained the highest recorded commit activity in the loaded history.`,
    })
  }

  // 4. Largest Change Set
  if (evolution.largestChangeCommit) {
    const lc = evolution.largestChangeCommit
    insights.push({
      id: 'largest_change_set',
      title: 'LARGEST CHANGE SET',
      icon: '📦',
      metric: `${lc.files.length} files`,
      subject: `Commit ${lc.sha.slice(0, 7)}`,
      description: `Commit ${lc.sha.slice(0, 7)} by ${lc.authorName} affected ${lc.files.length} recorded files, the largest single change set observed.`,
      targetSha: lc.sha,
    })
  }

  // 5. Contributor with Most Recorded Touches
  const contributorTouches = new Map()
  for (const f of evolution.files) {
    for (const ev of f.events) {
      const author = ev.commit.authorName || 'Unknown'
      contributorTouches.set(author, (contributorTouches.get(author) || 0) + 1)
    }
  }
  if (contributorTouches.size > 0) {
    const topAuthor = [...contributorTouches.entries()].sort((a, b) => b[1] - a[1])[0]
    insights.push({
      id: 'top_contributor_touches',
      title: 'CONTRIBUTOR WITH MOST RECORDED TOUCHES',
      icon: '👤',
      metric: `${topAuthor[1]} file touches`,
      subject: topAuthor[0],
      description: `${topAuthor[0]} accounted for ${topAuthor[1]} recorded file touches across the repository history.`,
    })
  }

  return insights
}
