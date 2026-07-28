/**
 * healthAnalytics.js
 *
 * Deterministic calculation of repository health scores.
 * All metrics are strictly clamped between 0 and 100.
 *
 * Missing or insufficient data is handled by omitting the metric
 * and proportionately re-weighting the remaining available metrics.
 */

function clamp(value, min = 0, max = 100) {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return 0
  return Math.max(min, Math.min(max, Math.round(value)))
}

function calculateCommitActivity(commits, repoAgeInDays) {
  if (commits.length === 0) return { available: false, score: 0 }
  
  // Normalise for age
  let score = 0
  
  if (repoAgeInDays <= 14) {
    // Very new repo: just having commits is good
    score = Math.min(100, commits.length * 15)
  } else {
    const commitsPerWeek = (commits.length / repoAgeInDays) * 7
    // ~10 commits a week is excellent
    score = (commitsPerWeek / 10) * 100
  }
  
  // Bonus for recent activity
  const now = Date.now() / 1000
  const latestTs = commits[commits.length - 1].timestamp
  const daysSinceLastCommit = (now - latestTs) / 86400
  
  if (daysSinceLastCommit <= 7) {
    score += 15
  } else if (daysSinceLastCommit > 30) {
    score -= 20
  }

  return { available: true, score: clamp(score) }
}

function calculateContributorHealth(commits, contributors, isSolo) {
  if (commits.length === 0) return { available: false, score: 0 }
  
  if (isSolo) {
    // Solo project: health depends on consistent personal activity
    // We already measure activity elsewhere, so give a baseline healthy score
    // for a maintained solo project
    const repoAgeInDays = commits.length > 1 ? (commits[commits.length-1].timestamp - commits[0].timestamp) / 86400 : 0
    if (repoAgeInDays > 30 && commits.length > 20) return { available: true, score: 95 }
    if (commits.length > 5) return { available: true, score: 85 }
    return { available: true, score: 75 }
  }

  // Multi-contributor project
  const contributorCount = contributors.length || 1
  let score = Math.min(100, contributorCount * 20) // Base score on number of contributors
  
  // Check distribution (avoid one person doing 99% of work)
  const commitCounts = commits.reduce((acc, c) => {
    const author = c.authorLogin || c.authorName || 'unknown'
    acc[author] = (acc[author] || 0) + 1
    return acc
  }, {})
  
  const values = Object.values(commitCounts)
  const maxCommitsByOne = Math.max(...values)
  const dominanceRatio = maxCommitsByOne / commits.length
  
  if (dominanceRatio > 0.9 && contributorCount > 1) {
    score -= 20 // Penalize heavy dominance if it's supposed to be collaborative
  } else if (dominanceRatio < 0.6 && contributorCount > 2) {
    score += 15 // Reward good distribution
  }

  return { available: true, score: clamp(score) }
}

function calculateDevelopmentConsistency(commits, repoAgeInDays) {
  if (commits.length < 3 || repoAgeInDays < 7) {
    return { available: false, score: 0 } // Not enough data
  }

  let score = 100
  
  // Look for large gaps
  let largestGapDays = 0
  for (let i = 1; i < commits.length; i++) {
    const gap = (commits[i].timestamp - commits[i-1].timestamp) / 86400
    if (gap > largestGapDays) largestGapDays = gap
  }

  if (largestGapDays > 90) {
    score -= 40
  } else if (largestGapDays > 30) {
    score -= 20
  } else if (largestGapDays > 14) {
    score -= 10
  }

  // Frequency of commits
  const activeDays = new Set(commits.map(c => {
    const d = new Date(c.timestamp * 1000)
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
  })).size
  
  const activeDayRatio = activeDays / Math.max(1, repoAgeInDays)
  if (activeDayRatio < 0.05) {
    score -= 15
  } else if (activeDayRatio > 0.2) {
    score += 10
  }

  return { available: true, score: clamp(score) }
}

function calculateCollaboration(commits, branches, isSolo) {
  if (commits.length < 2) return { available: false, score: 0 }

  let score = 50 // Baseline

  const mergeCommits = commits.filter(c => c.isMerge).length
  const hasMerges = mergeCommits > 0
  const multipleBranches = branches && branches.length > 1

  if (isSolo) {
    // Solo developer: collaboration means good Git usage (using branches/PRs occasionally)
    if (multipleBranches || hasMerges) {
      score = 95
    } else {
      score = 80 // Reasonable for solo to push straight to main
    }
  } else {
    // Team: expect branches and merges
    if (hasMerges) score += 25
    if (multipleBranches) score += 20
    
    // Check if multiple people merge
    const mergers = new Set(commits.filter(c => c.isMerge).map(c => c.authorLogin || c.authorName))
    if (mergers.size > 1) score += 15
  }

  return { available: true, score: clamp(score) }
}

function calculateCodeChangeHealth(commits) {
  const commitsWithFiles = commits.filter(c => Array.isArray(c.files) && c.files.length > 0)
  
  if (commitsWithFiles.length === 0) {
    return { available: false, score: 0 }
  }

  let score = 100
  let largeCommits = 0
  
  commitsWithFiles.forEach(c => {
    if (c.files.length > 50) {
      largeCommits++
    }
  })

  const largeCommitRatio = largeCommits / commitsWithFiles.length
  
  if (largeCommitRatio > 0.2) {
    score -= 30
  } else if (largeCommitRatio > 0.1) {
    score -= 15
  }

  return { available: true, score: clamp(score) }
}

function calculateMomentum(commits, repoAgeInDays) {
  if (commits.length < 10 || repoAgeInDays < 14) {
    return { available: false, score: 0 }
  }

  const now = Math.max(...commits.map(c => c.timestamp))
  const thirtyDaysAgo = now - (30 * 86400)
  
  const recentCommits = commits.filter(c => c.timestamp >= thirtyDaysAgo).length
  const olderCommits = commits.length - recentCommits
  
  // If the repo is young, don't penalize
  if (repoAgeInDays <= 30) return { available: true, score: 90 }
  
  // Calculate historical rate
  const olderRate = olderCommits / Math.max(1, repoAgeInDays - 30)
  const recentRate = recentCommits / 30
  
  let score = 75 // Stable baseline
  
  if (recentRate > olderRate * 1.5) {
    score += 20 // Increasing momentum
  } else if (recentRate < olderRate * 0.5) {
    score -= 20 // Declining momentum
  }

  if (recentCommits === 0) {
    score -= 30 // No recent activity
  }

  return { available: true, score: clamp(score) }
}

export function generateHealthInsights(metrics, isSolo) {
  const insights = []

  // Commit Activity
  if (metrics.commitActivity.available) {
    if (metrics.commitActivity.score >= 80) {
      insights.push({ type: 'positive', text: 'Consistent development activity' })
    } else if (metrics.commitActivity.score < 50) {
      insights.push({ type: 'negative', text: 'Development activity is relatively low' })
    }
  }

  // Contributor Health
  if (metrics.contributorHealth.available) {
    if (isSolo) {
      insights.push({ type: 'neutral', text: 'Repository is actively maintained by a solo developer' })
    } else {
      if (metrics.contributorHealth.score >= 80) {
        insights.push({ type: 'positive', text: 'Healthy distribution of contributor activity' })
      } else if (metrics.contributorHealth.score < 60) {
        insights.push({ type: 'negative', text: 'One contributor dominates repository activity' })
      }
    }
  }

  // Consistency
  if (metrics.consistency.available) {
    if (metrics.consistency.score >= 80) {
      insights.push({ type: 'positive', text: 'Strong consistency with few prolonged gaps' })
    } else if (metrics.consistency.score < 60) {
      insights.push({ type: 'negative', text: 'Repository has noticeable inactive periods' })
    }
  }

  // Collaboration
  if (metrics.collaboration.available && !isSolo) {
    if (metrics.collaboration.score >= 80) {
      insights.push({ type: 'positive', text: 'Active use of branches and pull requests' })
    } else if (metrics.collaboration.score < 60) {
      insights.push({ type: 'negative', text: 'Limited branch collaboration detected' })
    }
  }

  // Code Change Health
  if (metrics.codeChangeHealth.available) {
    if (metrics.codeChangeHealth.score >= 80) {
      insights.push({ type: 'positive', text: 'Commit sizes are generally healthy and focused' })
    } else if (metrics.codeChangeHealth.score < 60) {
      insights.push({ type: 'negative', text: 'Several unusually large commits detected' })
    }
  }

  // Momentum
  if (metrics.momentum.available) {
    if (metrics.momentum.score >= 80) {
      insights.push({ type: 'positive', text: 'Development momentum is increasing' })
    } else if (metrics.momentum.score < 50) {
      insights.push({ type: 'negative', text: 'Development momentum has decreased recently' })
    }
  }

  return insights
}

export function calculateRepositoryHealth(parsedData) {
  if (!parsedData || !parsedData.commits || parsedData.commits.length === 0) {
    return { score: 0, status: 'No Data', metrics: {}, insights: [], activityTrend: [] }
  }

  const commits = [...parsedData.commits].sort((a, b) => a.timestamp - b.timestamp)
  const branches = parsedData.branches || []
  
  // Aggregate contributors properly
  const contributorSet = new Set(commits.map(c => c.authorLogin || c.authorName || 'unknown'))
  const contributors = Array.from(contributorSet)
  const isSolo = contributors.length === 1

  const firstCommitTs = commits[0].timestamp
  const lastCommitTs = commits[commits.length - 1].timestamp
  const repoAgeInDays = Math.max(1, (lastCommitTs - firstCommitTs) / 86400)

  // Define metrics and their configurations
  const metricConfigs = {
    commitActivity:    { calc: () => calculateCommitActivity(commits, repoAgeInDays),         weight: 25 },
    contributorHealth: { calc: () => calculateContributorHealth(commits, contributors, isSolo), weight: 20 },
    consistency:       { calc: () => calculateDevelopmentConsistency(commits, repoAgeInDays),   weight: 20 },
    collaboration:     { calc: () => calculateCollaboration(commits, branches, isSolo),         weight: 15 },
    codeChangeHealth:  { calc: () => calculateCodeChangeHealth(commits),                        weight: 10 },
    momentum:          { calc: () => calculateMomentum(commits, repoAgeInDays),                 weight: 10 },
  }

  const metrics = {}
  let totalAvailableWeight = 0
  let weightedScoreSum = 0

  // Calculate each metric
  for (const [key, config] of Object.entries(metricConfigs)) {
    const result = config.calc()
    metrics[key] = {
      available: result.available,
      score: result.available ? result.score : null,
      weight: config.weight
    }
    if (result.available) {
      totalAvailableWeight += config.weight
      weightedScoreSum += result.score * config.weight
    }
  }

  // Normalize final score based on available weight
  let finalScore = 0
  if (totalAvailableWeight > 0) {
    finalScore = clamp(weightedScoreSum / totalAvailableWeight)
  }

  // Determine status string
  let status = 'Poor'
  if (finalScore >= 90) status = 'Excellent'
  else if (finalScore >= 75) status = 'Healthy'
  else if (finalScore >= 60) status = 'Moderate'
  else if (finalScore >= 40) status = 'Needs Attention'

  const insights = generateHealthInsights(metrics, isSolo)

  // Build basic activity trend data (just daily commit counts for simplicity)
  // The UI can bucket this further if needed.
  const dailyCounts = {}
  commits.forEach(c => {
    const d = new Date(c.timestamp * 1000)
    const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
    dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1
  })

  const activityTrend = Object.entries(dailyCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))

  return {
    score: finalScore,
    status,
    metrics,
    insights,
    activityTrend
  }
}
