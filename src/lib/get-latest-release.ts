import { Releases } from '../providers/github'
import { Bindings } from './bindings'
import { USER_AGENT, reponame, username } from './constants'
import { getCache, setCache } from './cache'

const RELEASE_CACHE_TTL = 60 * 30 // 30 minutes

export const getLatestRelease = async (
  bindings: Bindings
): Promise<Releases | null> => {
  const url = `https://api.github.com/repos/${username}/${reponame}/releases/latest`
  const cacheKey = `github-release-${username}-${reponame}-latest`
  
  // Check Durable Object cache first
  const cached = await getCache(bindings, cacheKey)
  if (cached && cached.expires > Date.now()) {
    console.log('Getting latest release from cache', url)
    const textDecoder = new TextDecoder()
    const jsonString = textDecoder.decode(cached.data)
    return JSON.parse(jsonString)
  }
  
  console.log('Getting latest release from GitHub', url)
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.preview',
    'user-agent': USER_AGENT,
  }

  // Add github token if provided
  if (bindings.GITHUB_TOKEN && bindings.GITHUB_TOKEN.length > 0) {
    headers.Authorization = `token ${bindings.GITHUB_TOKEN}`
  }

  const response = await fetch(url.toString(), {
    cf: { cacheKey: 'pastebar-latest-release', cacheTtl: 600 },
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    // If fetch failed but we have expired cache, use it as fallback
    if (cached) {
      console.log('GitHub API request failed, using expired cache for latest release')
      const textDecoder = new TextDecoder()
      const jsonString = textDecoder.decode(cached.data)
      return JSON.parse(jsonString)
    }
    return null
  }

  const release = await response.json()
  
  // Store in Durable Object cache
  const textEncoder = new TextEncoder()
  await setCache(bindings, cacheKey, {
    data: textEncoder.encode(JSON.stringify(release)).buffer,
    headers: [...response.headers.entries()],
    expires: Date.now() + RELEASE_CACHE_TTL * 1000,
  })

  return release
}
