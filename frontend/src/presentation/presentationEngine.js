/**
 * presentationEngine.js
 *
 * Pure JavaScript engine for Cinematic Repository Presentation Mode.
 * No React. No JSX.
 * Orchestrates and reuses existing analytics (repository, story, files, insights, time machine)
 * to build an automated, dynamic presentation structure.
 */

import { analyzeRepository } from '../analytics/repositoryAnalytics'
import { generateStory } from '../analytics/storyGenerator'
import { analyzeFileEvolution, generateEngineeringInsights } from '../analytics/fileAnalytics'
import { buildRepositoryTimeline, getSnapshotAtTime } from '../analytics/timeMachineAnalytics'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

/**
 * generatePresentationScenes(parsedData)
 * Returns an array of precomputed scene objects tailored to the repository's history.
 */
export function generatePresentationScenes(parsedData) {
  if (!parsedData || !Array.isArray(parsedData.commits) || parsedData.commits.length === 0) {
    return []
  }

  const repoAnalytics = analyzeRepository(parsedData)
  const fileAnalytics = analyzeFileEvolution(parsedData)
  const timeline = buildRepositoryTimeline(parsedData)
  const storyMilestones = generateStory(repoAnalytics, { owner: parsedData.owner, repo: parsedData.repo })
  const allInsights = generateEngineeringInsights(parsedData)

  const scenes = []

  // ── SCENE 1: INTRO (Manual start) ──
  scenes.push({
    id: 'intro',
    type: 'intro',
    owner: parsedData.owner || 'repository',
    repo: parsedData.repo || 'project',
    title: parsedData.repo || 'Repository',
    subtitle: 'Explore how this repository evolved.',
    commitCount: repoAnalytics?.commitCount || parsedData.commits.length,
    repoAgeDays: repoAnalytics?.repoAgeInDays || 0,
    duration: null, // manual "▶ Begin Presentation"
  })

  // ── SCENE 2: PROJECT ORIGIN ──
  const firstCommit = repoAnalytics?.firstCommit || parsedData.commits[0]
  scenes.push({
    id: 'origin',
    type: 'origin',
    dateStr: fmtDate(firstCommit?.timestamp),
    message: firstCommit?.message?.split('\n')[0] || 'Initial commit',
    author: firstCommit?.authorName || 'Unknown',
    sha: firstCommit?.sha ? firstCommit.sha.slice(0, 7) : '',
    duration: 6000, // 6s
  })

  // ── SCENE 3: REPOSITORY EVOLUTION (Hero Scene with Git Graph) ──
  scenes.push({
    id: 'evolution',
    type: 'evolution',
    minTs: timeline.minTs,
    maxTs: timeline.maxTs,
    milestones: storyMilestones.slice(0, 6),
    commitCount: parsedData.commits.length,
    duration: 13000, // 13s
  })

  // ── SCENE 4: CONTRIBUTORS (Dynamic: skip if 0, simplify if 1) ──
  if (repoAnalytics && repoAnalytics.contributorActivity.length > 0) {
    const sortedContribs = [...repoAnalytics.contributorActivity]
      .sort((a, b) => b.commits.length - a.commits.length)
      .slice(0, 4)

    const totalCommits = repoAnalytics.commitCount || 1

    scenes.push({
      id: 'contributors',
      type: 'contributors',
      topContributors: sortedContribs.map(c => ({
        authorName: c.authorName,
        commitCount: c.commits.length,
        percentage: Math.round((c.commits.length / totalCommits) * 100),
        firstDate: fmtDate(c.firstTimestamp),
      })),
      mostActive: sortedContribs[0]?.authorName || 'Unknown',
      isSingleContributor: sortedContribs.length === 1,
      duration: 7500, // 7.5s
    })
  }

  // ── SCENE 5: CODEBASE EVOLUTION (Dynamic: skip if no file data) ──
  if (fileAnalytics && fileAnalytics.files.length > 0) {
    scenes.push({
      id: 'codebase',
      type: 'codebase',
      topDirectories: fileAnalytics.mostActiveDirectories.slice(0, 5),
      mostTouchedFile: fileAnalytics.mostChangedFiles[0] || null,
      mostActiveDir: fileAnalytics.mostActiveDirectories[0] || null,
      fileCount: fileAnalytics.fileCount,
      dirCount: fileAnalytics.dirCount,
      duration: 7500, // 7.5s
    })
  }

  // ── SCENE 6: ENGINEERING INSIGHTS (Dynamic: select top 3-4 strongest) ──
  if (allInsights && allInsights.length > 0) {
    // Pick the top 3-4 strongest insights
    const selectedInsights = allInsights.slice(0, 4)
    scenes.push({
      id: 'insights',
      type: 'insights',
      insights: selectedInsights,
      duration: 8500, // 8.5s
    })
  }

  // ── SCENE 7: TIME MACHINE SEQUENCE (Progressive timeline reconstruction) ──
  if (timeline.minTs && timeline.maxTs && timeline.maxTs > timeline.minTs) {
    const span = timeline.maxTs - timeline.minTs
    const steps = [0, 0.25, 0.5, 0.75, 1.0].map(pct => {
      const ts = timeline.minTs + span * pct
      return getSnapshotAtTime(parsedData, ts)
    }).filter(Boolean)

    scenes.push({
      id: 'time_machine',
      type: 'time_machine',
      steps,
      minTs: timeline.minTs,
      maxTs: timeline.maxTs,
      duration: 9500, // 9.5s
    })
  }

  // ── SCENE 8: FINAL SCENE (Repository Today - Manual exit) ──
  const finalSnapshot = getSnapshotAtTime(parsedData, timeline.maxTs)
  scenes.push({
    id: 'final',
    type: 'final',
    owner: parsedData.owner || 'repository',
    repo: parsedData.repo || 'project',
    snapshot: finalSnapshot,
    repoAgeDays: repoAnalytics?.repoAgeInDays || 0,
    duration: null, // manual exit
  })

  return scenes
}
