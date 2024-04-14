import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { downloadGitHubAsset } from './lib/download-github-asset'
import github, { Arch } from './providers/github'
import { getLatestRelease } from './lib/get-latest-release'
import type { Bindings } from './lib/bindings'

const app = new Hono<{
  Bindings: Bindings
}>()

app.use('/*', cors())

app.use(async (c, next) => {
  console.log(c.req.method, c.req.url)
  await next()
})

app.all('/latest', async (c) => {
  const release = await getLatestRelease(c.env)
  if (!release) return c.notFound()
  return c.json(release)
})

app.get('/check/:platform/:arch/:version', (c) => {
  console.log('Checking updates', c.req.url)
  const url = new URL(c.req.url)
  const params = c.req.param()
  return github({
    ...params,
    bindings: c.env,
    arch: params.arch as Arch,
    rootUrl: `${url.protocol}//${url.host}`,
  })
})

app.get('/github/download-asset', (c) => {
  const asset = c.req.query('asset')
  const filename = c.req.query('filename')
  if (!asset || !filename) return c.notFound()
  return downloadGitHubAsset(c.env, asset, filename)
})

app.get('/ping', (c) => {
  return c.text(`pong ${new Date()}`, { status: 200 })
})

export default app
