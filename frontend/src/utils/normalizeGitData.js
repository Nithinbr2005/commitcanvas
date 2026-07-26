/**
 * Normalizes raw repository data into a strictly typed format for the graph.
 */
export function normalizeGitData(parsed) {
  if (!parsed || !parsed.commits || !Array.isArray(parsed.commits)) {
    return { commits: [], branches: [], contributors: [] };
  }

  const rawCommits = parsed.commits;
  const branches = parsed.branches || [];
  
  // Sort from oldest to newest
  const sorted = [...rawCommits].sort((a, b) => a.timestamp - b.timestamp);
  
  // Find head sha (tip of the default branch, or latest commit)
  let headSha = null;
  const mainBranch = branches.find(b => b.name === 'main' || b.name === 'master');
  if (mainBranch && mainBranch.tip) {
    headSha = mainBranch.tip;
  } else if (sorted.length > 0) {
    headSha = sorted[sorted.length - 1].sha;
  }

  const normalizedCommits = sorted.map(c => {
    return {
      sha: c.sha,
      shortSha: c.sha ? c.sha.substring(0, 7) : '',
      message: c.message || '',
      authorName: c.author?.name || 'Unknown',
      authorLogin: c.author?.login || c.author?.name || 'Unknown',
      avatarUrl: c.author?.avatarUrl || c.author?.avatar_url || null,
      date: new Date(c.timestamp * 1000).toISOString(),
      timestamp: c.timestamp, // Keep for sorting/playback
      parents: Array.isArray(c.parents) ? c.parents.map(p => typeof p === 'string' ? p : p.sha) : [],
      isMerge: Array.isArray(c.parents) && c.parents.length > 1,
      branch: c.branch || null,
      isHead: c.sha === headSha,
      files: c.files || []
    };
  });

  return {
    ...parsed,
    commits: normalizedCommits,
    headSha
  };
}
