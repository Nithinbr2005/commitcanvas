/**
 * apiHelpers.js
 *
 * Robust input parsing and API error classification for CommitCanvas.
 * Prevents raw stack traces and provides user-friendly error messages.
 */

/**
 * parseGitHubUrl(input)
 * Parses various GitHub URL formats (e.g. https://github.com/owner/repo, owner/repo, etc.)
 * Returns { owner, repo, repoUrl } or null if invalid.
 */
export function parseGitHubUrl(input) {
  if (!input || typeof input !== 'string') return null

  let str = input.trim()
  if (!str) return null

  // Strip trailing slashes, .git extensions, and query parameters
  str = str.replace(/\.git$/, '').replace(/\/$/, '').split('?')[0].split('#')[0]

  // Pattern 1: https://github.com/owner/repo or http://github.com/owner/repo
  const fullUrlMatch = str.match(/^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (fullUrlMatch) {
    const owner = fullUrlMatch[1]
    const repo = fullUrlMatch[2]
    return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}` }
  }

  // Pattern 2: github.com/owner/repo
  const domainMatch = str.match(/^github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (domainMatch) {
    const owner = domainMatch[1]
    const repo = domainMatch[2]
    return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}` }
  }

  // Pattern 3: owner/repo
  const shortMatch = str.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shortMatch) {
    const owner = shortMatch[1]
    const repo = shortMatch[2]
    return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}` }
  }

  return null
}

/**
 * formatApiError(err)
 * Classifies HTTP and network failures into clear, professional error objects.
 * Returns { title, message, isRateLimit, resetTime, canRetry }
 */
export function formatApiError(err) {
  if (!err) {
    return {
      title: 'Unexpected Error',
      message: 'An unknown error occurred while processing the request.',
      canRetry: true,
    }
  }

  const status = err.response?.status
  const backendError = typeof err.response?.data?.error === 'string' ? err.response.data.error : null
  const headers = err.response?.headers || {}

  // Rate limit reset header parsing
  let resetTime = null
  if (headers['x-ratelimit-reset']) {
    const resetTs = parseInt(headers['x-ratelimit-reset'], 10)
    if (!isNaN(resetTs)) {
      resetTime = new Date(resetTs * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
  }

  // 1. Rate Limit (HTTP 429 or HTTP 403 rate limit)
  if (status === 429 || (status === 403 && (backendError?.toLowerCase().includes('rate limit') || headers['x-ratelimit-remaining'] === '0'))) {
    return {
      title: 'GitHub API Rate Limit Reached',
      message: resetTime
        ? `The GitHub API rate limit has been reached for this IP. Rate limit resets at ${resetTime}.`
        : 'The GitHub API rate limit has been reached. Please wait a few minutes before requesting again.',
      isRateLimit: true,
      resetTime,
      canRetry: true,
    }
  }

  // 2. Forbidden / Inaccessible (HTTP 403 non-rate-limit)
  if (status === 403) {
    return {
      title: 'Repository Access Forbidden',
      message: backendError || 'Access to this repository is forbidden. It may be private or restricted.',
      canRetry: false,
    }
  }

  // 3. Not Found (HTTP 404)
  if (status === 404) {
    return {
      title: 'Repository Not Found',
      message: 'We couldn\'t find this repository. Please check that the URL or owner/repository name is correct and publicly accessible.',
      canRetry: true,
    }
  }

  // 4. Network or Backend Failure (No response or 5xx)
  if (!err.response || status >= 500) {
    return {
      title: 'Connection Issue',
      message: backendError || 'Failed to connect to the backend service. Please check your internet connection and try again.',
      canRetry: true,
    }
  }

  // 5. Backend provided specific error
  if (backendError) {
    return {
      title: 'Unable to Load Repository',
      message: backendError,
      canRetry: true,
    }
  }

  // 6. Generic Fallback
  return {
    title: 'Unable to Load Repository',
    message: err.message || 'An error occurred while fetching repository data.',
    canRetry: true,
  }
}
