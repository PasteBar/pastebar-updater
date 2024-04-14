import { Releases } from '../providers/github'
import { Bindings } from './bindings'
import { USER_AGENT, reponame, username } from './constants'

export const getLatestRelease = async (
  bindings: Bindings
): Promise<Releases | null> => {
  const url = `https://api.github.com/repos/${username}/${reponame}/releases/latest`
  console.log('Getting latest release', url)
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

  if (!response.ok) return null

  return response.json()
}
