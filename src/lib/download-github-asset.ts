import { notFound } from './response'
import { Bindings } from './bindings'
import { USER_AGENT } from './constants'

export async function fetchGitHubAsset(bindings: Bindings, asset: string) {
  const response = await fetch(asset, {
    cf: { cacheEverything: true, cacheTtl: 1800 },
    headers: {
      Accept: 'application/octet-stream',
      'user-agent': USER_AGENT,
    },
  })
  return response
}

export async function downloadGitHubAsset(
  bindings: Bindings,
  asset: string,
  filename: string
): Promise<Response> {
  console.log('downloadGitHubAsset called with:', { asset, filename })
  
  let response = await fetchGitHubAsset(bindings, asset)
  console.log('downloadGitHubAsset response status:', response.status, 'ok:', response.ok)

  if (!response.ok) {
    // retry once
    console.log('First fetch failed, retrying...')
    response = await fetchGitHubAsset(bindings, asset)
    if (!response.ok) {
      console.log('Retry failed with status:', response.status)
      return notFound()
    }
  }

  console.log('Fetch successful, streaming response...')
  const headers = new Headers(response.headers)
  headers.set('Content-Disposition', `attachment; filename="${filename}"`)
  
  // Stream the response directly without buffering
  return new Response(response.body, { headers })
}
