import { notFound } from './response'
import { Bindings } from './bindings'
import { USER_AGENT } from './constants'
import { getCache, setCache } from './cache'

export async function fetchGitHubAsset(bindings: Bindings, asset: string) {
  const response = await fetch(asset, {
    cf: { cacheEverything: true, cacheTtl: 1800 },
    headers: {
      Accept: 'application/octet-stream',
      Authorization: `token ${bindings.GITHUB_TOKEN}`,
      'user-agent': USER_AGENT,
    },
  })
  return response
}

const LOCAL_CACHE_TTL = 60 * 60 // 1 hour

export async function downloadGitHubAsset(
  bindings: Bindings,
  asset: string,
  filename: string
): Promise<Response> {
  let response = await fetchGitHubAsset(bindings, asset)
  console.log('downloadGitHubAsset response', response)

  if (!response.ok) {
    const cached = await getCache(bindings, asset)
    if (cached) {
      const headers = new Headers(cached.headers)
      headers.set('Content-Disposition', `attachment; filename="${filename}"`)
      return new Response(cached.data.slice(0), { headers })
    }

    // retry once
    response = await fetchGitHubAsset(bindings, asset)
    if (!response.ok) {
      return notFound()
    }
  }

  const data = await response.arrayBuffer()
  await setCache(bindings, asset, {
    data,
    headers: [...response.headers.entries()],
    expires: Date.now() + LOCAL_CACHE_TTL * 1000,
  })

  const headers = new Headers(response.headers)
  headers.set('Content-Disposition', `attachment; filename="${filename}"`)
  return new Response(data, { headers })
}
