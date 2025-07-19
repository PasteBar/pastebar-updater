import type { Bindings } from './bindings'

export type CacheEntry = {
  data: ArrayBuffer
  headers: [string, string][]
  expires: number
}

export async function setCache(
  bindings: Bindings,
  key: string,
  entry: CacheEntry
) {
  const id = bindings.ASSET_CACHE.idFromName(key)
  const stub = bindings.ASSET_CACHE.get(id)
  await stub.fetch('https://cache/', {
    method: 'PUT',
    headers: {
      'x-ttl': String(Math.ceil((entry.expires - Date.now()) / 1000)),
      'x-headers': JSON.stringify(entry.headers),
    },
    body: entry.data,
  })
}

export async function getCache(
  bindings: Bindings,
  key: string
): Promise<CacheEntry | undefined> {
  const id = bindings.ASSET_CACHE.idFromName(key)
  const stub = bindings.ASSET_CACHE.get(id)
  const res = await stub.fetch('https://cache/', { method: 'GET' })
  if (res.status !== 200) return undefined
  const headers = JSON.parse(res.headers.get('x-headers') || '[]') as [string, string][]
  const expires = Number(res.headers.get('x-expires')) || 0
  const data = await res.arrayBuffer()
  return { data, headers, expires }
}
