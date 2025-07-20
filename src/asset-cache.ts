import { DurableObject } from 'cloudflare:workers'

export type CacheEntry = {
  data: ArrayBuffer
  headers: [string, string][]
  expires: number
}

export class AssetCache extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      const entry = (await this.ctx.storage.get<CacheEntry>('entry')) || null
      if (!entry || entry.expires < Date.now()) {
        if (entry) {
          await this.ctx.storage.delete('entry')
        }
        return new Response('not found', { status: 404 })
      }
      const res = new Response(entry.data)
      res.headers.set('x-headers', JSON.stringify(entry.headers))
      res.headers.set('x-expires', entry.expires.toString())
      return res
    }

    if (request.method === 'PUT') {
      const ttl = parseInt(request.headers.get('x-ttl') || '3600', 10)
      const headers = JSON.parse(request.headers.get('x-headers') || '[]') as [string, string][]
      const data = await request.arrayBuffer()
      const entry: CacheEntry = { data, headers, expires: Date.now() + ttl * 1000 }
      await this.ctx.storage.put('entry', entry)
      return new Response('ok')
    }

    return new Response('Method Not Allowed', { status: 405 })
  }
}
