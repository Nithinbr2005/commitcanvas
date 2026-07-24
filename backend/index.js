const express = require('express');
const cors = require('cors');
const LRU = require('lru-cache');
const dotenv = require('dotenv');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');

const axios = require('axios');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const cache = new LRU({ max: 200, ttl: 1000 * 60 * 60 }); // 1 hour
const PORT = process.env.PORT || 4000;

// Utility: validate a simple GitHub URL
function parseGithubUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if ((u.hostname === 'github.com' || u.hostname.endsWith('.github.com'))) {
      const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Example repositories
function exampleSmallParsedRepo() {
  const commits = [
    { sha: 's1', parents: [], timestamp: 1677628800, message: 'Initial commit', files: ['README.md'], author: { name: 'Alice', email: 'alice@example.com' }, branch: 'main' },
    { sha: 's2', parents: ['s1'], timestamp: 1677715200, message: 'Add auth module', files: ['auth.js'], author: { name: 'Bob', email: 'bob@example.com' }, branch: 'main' },
    { sha: 's3', parents: ['s2'], timestamp: 1677801600, message: 'Feature: widget', files: ['widget.js'], author: { name: 'Eve', email: 'eve@example.com' }, branch: 'develop' },
    { sha: 's4', parents: ['s3', 's2'], timestamp: 1677888000, message: 'Merge develop', files: [], author: { name: 'Alice', email: 'alice@example.com' }, branch: 'main' },
    { sha: 's5', parents: ['s4'], timestamp: 1677974400, message: 'Refactor', files: ['auth.js'], author: { name: 'Bob', email: 'bob@example.com' }, branch: 'main' }
  ];
  const branches = [{ name: 'main', tip: 's5' }, { name: 'develop', tip: 's3' }];
  return { repo: 'example/small', lastCommitSha: 's5', commits, branches, contributors: [], markers: [] };
}
function exampleMediumParsedRepo() { const commits = []; for (let i = 0; i < 50; i++) { commits.push({ sha: 'm' + String(i).padStart(3, '0'), parents: i === 0 ? [] : ['m' + String(i - 1).padStart(3, '0')], timestamp: 1677628800 + (i * 86400), message: 'Commit ' + i, files: [], author: { name: 'Dev', email: 'dev@example.com' }, branch: 'main' }); } return { repo: 'example/medium', lastCommitSha: 'm049', commits, branches: [], contributors: [], markers: [] }; }
function exampleLargeParsedRepo() { const commits = []; for (let i = 0; i < 500; i++) { commits.push({ sha: 'l' + String(i).padStart(4, '0'), parents: i === 0 ? [] : ['l' + String(i - 1).padStart(4, '0')], timestamp: 1650000000 + (i * 3600), message: 'Commit ' + i, files: [], author: { name: 'Dev', email: 'dev@example.com' }, branch: 'main' }); } return { repo: 'example/large', lastCommitSha: 'l0499', commits, branches: [], contributors: [], markers: [] }; }

// Small built-in sample repo used for presets and as a fallback
function sampleParsedRepo() {
  const commits = [
    { sha: 'c1', parents: [], timestamp: 1677628800, message: 'Initial commit', files: ['README.md'], author: { name: 'Alice', email: 'alice@example.com' }, branch: 'main' },
    { sha: 'c2', parents: ['c1'], timestamp: 1677715200, message: 'Add auth module', files: ['auth.js', 'package.json'], author: { name: 'Bob', email: 'bob@example.com' }, branch: 'main' },
    { sha: 'c3', parents: ['c2'], timestamp: 1677801600, message: 'Feature: widget', files: ['widget.js'], author: { name: 'Eve', email: 'eve@example.com' }, branch: 'feature/widget' },
    { sha: 'c4', parents: ['c3', 'c2'], timestamp: 1677888000, message: 'Merge feature/widget into main', files: ['widget.js'], author: { name: 'Alice', email: 'alice@example.com' }, branch: 'main' },
    { sha: 'c5', parents: ['c4'], timestamp: 1677974400, message: 'Refactor auth', files: ['auth.js', 'auth.test.js'], author: { name: 'Bob', email: 'bob@example.com' }, branch: 'main' }
  ];

  const branches = [
    { name: 'main', tip: 'c5' },
    { name: 'feature/widget', tip: 'c3' }
  ];

  const contributors = [
    { name: 'Alice', email: 'alice@example.com', avatarUrl: null, commits: 2 },
    { name: 'Bob', email: 'bob@example.com', avatarUrl: null, commits: 2 },
    { name: 'Eve', email: 'eve@example.com', avatarUrl: null, commits: 1 }
  ];

  const markers = [
    { type: 'first-commit', sha: 'c1', timestamp: commits[0].timestamp, label: 'First commit' },
    { type: 'biggest-commit', sha: 'c2', timestamp: commits[1].timestamp, label: 'Add auth module' }
  ];

  return { repo: 'example/demo', lastCommitSha: 'c5', commits, branches, contributors, markers };
}

// Generate a large synthetic parsed repo for stress testing without network/cloning overhead
function generateLargeParsedRepo(count = 2000) {
  const commits = [];
  const contributors = [];
  const authors = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Mallory', 'Trent', 'Peggy'];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < count; i++) {
    const sha = 's' + (count - i).toString().padStart(6, '0');
    const parents = i === 0 ? [] : ['s' + (count - i + 1).toString().padStart(6, '0')];
    // occasionally produce merges
    if (i % 100 === 0 && i > 0) parents.push('s' + (count - i + 2).toString().padStart(6, '0'));
    const timestamp = now - (count - i) * 60 * 60; // spaced hourly
    const author = authors[i % authors.length];
    const email = `${author.toLowerCase()}@example.com`;
    const message = `Commit ${i} - synthetic test data`;
    const files = [`file${i % 20}.js`];
    commits.push({ sha, parents, timestamp, message, files, author: { name: author, email }, branch: null });
  }
  // compute contributors summary
  const contribMap = new Map();
  commits.forEach(c => {
    const key = c.author.email || c.author.name;
    const entry = contribMap.get(key) || { name: c.author.name, email: c.author.email, avatarUrl: null, commits: 0 };
    entry.commits++;
    contribMap.set(key, entry);
  });
  const contribs = Array.from(contribMap.values());
  const markers = [
    { type: 'first-commit', sha: commits[commits.length-1].sha, timestamp: commits[commits.length-1].timestamp, label: 'First commit' },
    { type: 'latest-commit', sha: commits[0].sha, timestamp: commits[0].timestamp, label: 'Latest commit' }
  ];
  return { repo: 'example/stress', lastCommitSha: commits[0].sha, commits, branches: [{ name: 'main', tip: commits[0].sha }], contributors: contribs, markers };
}

function tmpDirForRepo(owner, repo) {
  const name = `${owner}-${repo}-${crypto.randomBytes(6).toString('hex')}`;
  return path.join(os.tmpdir(), 'commitcanvas', name);
}

async function safeRm(dir) {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch (e) {
    // ignore
  }
}

// Use GitHub API to get repository metadata
async function fetchRepoMeta(owner, repo, token) {
  const headers = token ? { Authorization: `token ${token}` } : {}
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const r = await axios.get(url, { headers }).catch((e) => {
    const status = e?.response?.status || 500;
    const msg = e?.response?.data?.message || e.message;
    const err = new Error(msg);
    err.status = status;
    throw err;
  });
  return r.data;
}

// Determine approximate commit count using GitHub commits endpoint and Link header
async function getCommitCount(owner, repo, token) {
  const headers = token ? { Authorization: `token ${token}` } : {}
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`;
  const r = await axios.get(url, { headers, validateStatus: (s) => s < 500 }).catch((e) => { throw e });
  const link = r.headers.link;
  if (!link) {
    // no pagination
    const length = Array.isArray(r.data) ? r.data.length : 0;
    return length;
  }
  // parse last page
  const m = link.match(/<([^>]+)>; rel="last"/);
  if (!m) return undefined;
  const lastUrl = new URL(m[1]);
  const page = Number(lastUrl.searchParams.get('page')) || 1;
  const per_page = Number(lastUrl.searchParams.get('per_page')) || 1;
  return page * per_page;
}

// Fetch commits via GitHub API (detailed per-commit to include files). Limits to maxCommits.
async function fetchCommitsViaAPI(owner, repo, token, maxCommits = 500) {
  const headers = token ? { Authorization: `token ${token}` } : {}
  // get branches
  const branchesRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, { headers }).catch(()=>({ data: [] }));
  const branches = (branchesRes.data || []).map(b => ({ name: b.name, tip: b.commit?.sha }));

  const perPage = 100;
  let page = 1;
  let collected = [];
  while (collected.length < maxCommits) {
    const r = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`, { headers, validateStatus: (s) => s < 500 }).catch((e) => { throw e });
    const list = r.data || [];
    if (!Array.isArray(list)) {
      // Unexpected response (rate limited or error payload)
      throw new Error('Unexpected GitHub response when listing commits: ' + JSON.stringify(list).slice(0,200));
    }
    if (list.length === 0) break;
    for (const item of list) {
      if (collected.length >= maxCommits) break;
      // fetch full commit detail
      try {
        const detail = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits/${item.sha}`, { headers, validateStatus: (s) => s < 500 });
        const c = detail.data;
        collected.push({
          sha: c.sha,
          parents: (c.parents || []).map(p => p.sha),
          timestamp: Math.floor(new Date(c.commit.author.date).getTime() / 1000),
          message: c.commit.message,
          files: (c.files || []).map(f => f.filename),
          author: { name: (c.author && c.author.login) || c.commit.author.name, email: c.commit.author.email, avatarUrl: c.author?.avatar_url || null },
          // branch assignment is not trivial; leave null for now
          branch: null
        });
      } catch (e) {
        // if per-commit fetch fails (rate limit), fall back to minimal info
        collected.push({ sha: item.sha, parents: (item.parents || []).map(p=>p.sha), timestamp: Math.floor(new Date(item.commit.author.date).getTime()/1000), message: item.commit.message, files: [], author: { name: item.commit.author.name, email: item.commit.author.email, avatarUrl: null }, branch: null });
      }
    }
    if (list.length < perPage) break;
    page++;
  }

  // compute markers
  const markers = [];
  if (collected.length > 0) markers.push({ type: 'first-commit', sha: collected[collected.length-1].sha, timestamp: collected[collected.length-1].timestamp, label: 'First commit' });
  if (collected.length > 0) markers.push({ type: 'latest-commit', sha: collected[0].sha, timestamp: collected[0].timestamp, label: 'Latest commit' });

  // compute contributors
  const contributorsMap = new Map();
  for (const c of collected) {
    const key = (c.author && (c.author.email || c.author.name)) || 'unknown';
    const entry = contributorsMap.get(key) || { name: c.author.name || 'unknown', email: c.author.email || null, avatarUrl: c.author.avatarUrl || null, commits: 0 };
    entry.commits++;
    contributorsMap.set(key, entry);
  }
  const contributors = Array.from(contributorsMap.values());

  return { repo: `${owner}/${repo}`, lastCommitSha: collected[0]?.sha || null, commits: collected, branches, contributors, markers };
}

// Attempt shallow clone using isomorphic-git for repos with manageable commit count
async function shallowCloneAndParse(owner, repo, token, depthLimit = 500) {
  const dir = tmpDirForRepo(owner, repo);
  await fsp.mkdir(dir, { recursive: true });
  const url = `https://github.com/${owner}/${repo}.git`;
  try {
    await git.clone({ fs, http, dir, url, depth: depthLimit, singleBranch: false, noCheckout: false, onAuth: token ? () => ({ username: 'x-access-token', password: token }) : undefined });
    // list commits via git.log
    const log = await git.log({ fs, dir, depth: depthLimit });
    // log is in reverse chronological order
    const commits = [];
    for (const entry of log) {
      const sha = entry.oid;
      const parents = (entry.commit.parent || []).map(p => p);
      const timestamp = Math.floor(new Date(entry.commit.author.timestamp * 1000).getTime() / 1000);
      const message = entry.commit.message;
      const author = { name: entry.commit.author.name, email: entry.commit.author.email, avatarUrl: null };
      // attempt to list files for this commit (isomorphic-git provides listFiles in newer versions)
      let files = [];
      try {
        if (typeof git.listFiles === 'function') {
          files = await git.listFiles({ fs, dir, ref: sha });
        }
      } catch (e) {
        files = [];
      }
      commits.push({ sha, parents, timestamp, message, files, author, branch: null });
    }
    // branches
    let branches = [];
    try {
      const b = await git.listBranches({ fs, dir });
      branches = await Promise.all(b.map(async (name) => { const tip = await git.resolveRef({ fs, dir, ref: name }).catch(()=>null); return { name, tip }; }));
    } catch (e) { branches = []; }

    const markers = [];
    if (commits.length > 0) markers.push({ type: 'first-commit', sha: commits[commits.length-1].sha, timestamp: commits[commits.length-1].timestamp, label: 'First commit' });
    if (commits.length > 0) markers.push({ type: 'latest-commit', sha: commits[0].sha, timestamp: commits[0].timestamp, label: 'Latest commit' });

    const contributorsMap = new Map();
    for (const c of commits) {
      const key = (c.author && (c.author.email || c.author.name)) || 'unknown';
      const entry = contributorsMap.get(key) || { name: c.author.name || 'unknown', email: c.author.email || null, avatarUrl: null, commits: 0 };
      entry.commits++;
      contributorsMap.set(key, entry);
    }
    const contributors = Array.from(contributorsMap.values());

    return { repo: `${owner}/${repo}`, lastCommitSha: commits[0]?.sha || null, commits, branches, contributors, markers };
  } finally {
    // cleanup to avoid temp growth
    setTimeout(() => safeRm(dir), 1000 * 5);
  }
}

// Endpoint: POST /api/repo/fetch
// Body: { repoUrl }
app.post('/api/repo/fetch', async (req, res) => {
  try {
    const { repoUrl } = req.body || {};
    if (!repoUrl) return res.status(400).json({ error: 'Missing repoUrl in request body' });

    // Quick validation for GitHub URL; for demo scaffolding, return sample data for known examples
    const parsed = parseGithubUrl(repoUrl);
    if (!parsed) {
      // Allow some builtin presets (small/medium/large) for demo/testing
      if (repoUrl === 'example:small' || repoUrl === 'small') {
        const data = exampleSmallParsedRepo();
        return res.json({ source: 'sample', data });
      }

      if (repoUrl === 'example:medium' || repoUrl === 'medium') {
        const data = exampleMediumParsedRepo();
        return res.json({ source: 'sample', data });
      }

      if (repoUrl === 'example:large' || repoUrl === 'large') {
        const data = exampleLargeParsedRepo();
        return res.json({ source: 'sample', data });
      }

      // special stress test generator for large datasets
      if (repoUrl === 'example:stress-2000' || repoUrl === 'example:stress') {
        const data = generateLargeParsedRepo(2000);
        return res.json({ source: 'generated', data });
      }

      return res.status(400).json({ error: 'Invalid or unsupported repo URL. For scaffold demo use e.g. https://github.com/facebook/react or example:small' });
    }

    const { owner, repo } = parsed;
    const cacheKey = `${owner}/${repo}`;
    if (cache.has(cacheKey)) {
      return res.json({ source: 'cache', data: cache.get(cacheKey) });
    }

    const token = process.env.GITHUB_TOKEN || null;

    // Fetch repo metadata to check accessibility and size
    let meta;
    try {
      meta = await fetchRepoMeta(owner, repo, token);
    } catch (e) {
      if (e.status === 404) return res.status(404).json({ error: 'Repository not found or private' });
      if (e.status === 403) {
        // rate limited or forbidden — log and continue to try clone fallback
        console.warn('GitHub metadata fetch returned 403 (rate limited or forbidden). Will attempt shallow clone fallback.');
        meta = null;
      } else {
        console.warn('Failed to fetch repo metadata, continuing with best-effort clone: ', e.message || e);
        meta = null;
      }
    }

    // Determine commit count if possible
    let commitCount;
    try {
      commitCount = await getCommitCount(owner, repo, token);
    } catch (e) {
      commitCount = undefined;
    }

    // If commitCount is small try shallow clone; if unknown, attempt clone as a fallback before API
    const CLONE_THRESHOLD = 800; // if commits <= this, attempt clone
    let data = null;

    if (typeof commitCount === 'number') {
      if (commitCount <= CLONE_THRESHOLD) {
        try {
          // allow deeper shallow clones for moderate repos
          data = await shallowCloneAndParse(owner, repo, token, Math.min(commitCount || 1500, 1500));
          cache.set(cacheKey, data);
          return res.json({ source: 'isomorphic-git', data });
        } catch (e) {
          console.error('Shallow clone failed, falling back to GitHub API:', e.message || e);
        }
      }
    } else {
      // commitCount unknown (e.g., rate-limited) — try clone first as a best-effort
      try {
        data = await shallowCloneAndParse(owner, repo, token, 1500);
        cache.set(cacheKey, data);
        return res.json({ source: 'isomorphic-git-unknown-count', data });
      } catch (e) {
        console.error('Shallow clone attempt failed (unknown commit count). Will try GitHub API as fallback:', e.message || e);
      }
    }

    // Use API-based fetching (limits to 1500 commits by default)
    try {
      const MAX_COMMITS = 1500;
      data = await fetchCommitsViaAPI(owner, repo, token, MAX_COMMITS);
      cache.set(cacheKey, data);
      return res.json({ source: 'github-api', data });
    } catch (e) {
      console.error('GitHub API fetch failed', e.message || e);
      // As a last-resort, return scaffold sample
      const sample = sampleParsedRepo();
      cache.set(cacheKey, sample);
      return res.json({ source: 'scaffold-sample', data: sample, warning: 'Failed to fetch real repo; returned sample data' });
    }
  } catch (err) {
    console.error('Error in /api/repo/fetch', err);
    return res.status(500).json({ error: 'Server error while fetching repo' });
  }
});

// Endpoint: POST /api/repo/narrate
// Body: { repoKey, chunks } where chunks is array of { startTimestamp, endTimestamp, commits: [...] }
app.post('/api/repo/narrate', async (req, res) => {
  try {
    const { repoKey, chunks } = req.body || {};
    if (!chunks || !Array.isArray(chunks)) return res.status(400).json({ error: 'Missing chunks array in body' });

    // If Anthropic key available, would call Claude here. For scaffold: generate simple synthetic narration.
    const narration = chunks.map((chunk, idx) => {
      const start = new Date((chunk.startTimestamp || 0) * 1000).toISOString().split('T')[0];
      const end = new Date((chunk.endTimestamp || 0) * 1000).toISOString().split('T')[0];
      const commitCount = (chunk.commits || []).length;
      const sampleText = `${start} → ${end}: ${commitCount} commit${commitCount === 1 ? '' : 's'} — ${commitCount > 0 ? chunk.commits[0].message : 'No activity'}`;
      return { id: `n-${idx}`, startTimestamp: chunk.startTimestamp, endTimestamp: chunk.endTimestamp, text: sampleText };
    });

    return res.json({ source: 'scaffold', narration });
  } catch (err) {
    console.error('Error in /api/repo/narrate', err);
    return res.status(500).json({ error: 'Server error while generating narration' });
  }
});

// Endpoint: POST /api/repo/export
// Body: { startTimestamp, endTimestamp, speed }
app.post('/api/repo/export', async (req, res) => {
  try {
    const { startTimestamp, endTimestamp, speed } = req.body || {};
    // For initial scaffold just return a message that export is not yet implemented server-side.
    return res.json({ message: 'Export endpoint scaffolded. Client-side capture is recommended for now. Server-side ffmpeg export to be implemented.', startTimestamp, endTimestamp, speed });
  } catch (err) {
    console.error('Error in /api/repo/export', err);
    return res.status(500).json({ error: 'Server error during export' });
  }
});

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: Date.now() }));

app.listen(PORT, () => {
  console.log(`CommitCanvas backend scaffold running on port ${PORT}`);
});



