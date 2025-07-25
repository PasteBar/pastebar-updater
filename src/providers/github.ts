import semver from 'semver'
import { json, notFound, noUpdateAvailable } from '../lib/response'
import { validatePlatform, AVAILABLE_PLATFORMS } from '../lib/platforms'
import { fetchGitHubAsset } from '../lib/download-github-asset'
import { getLatestRelease } from '../lib/get-latest-release'
import { Bindings } from '../lib/bindings'

// https://github.com/tauri-apps/tauri/blob/9b793eeb68902fc6794e9dc54cfc41323ff72169/core/tauri/src/updater/core.rs#L916
export type Arch =
  | 'i686'
  | 'x86_64'
  | 'armv7'
  | 'aarch64'
  | 'universal'
  | 'arm64'
  | 'x64'
  | 'm1'

export type Releases = {
  assets: [
    {
      name: string
      browser_download_url: string
      url: string
    }
  ]
  tag_name: string
  body: string
  published_at: string
}

const hasKeywords = (str: string, keywords: string[]) =>
  keywords.some((k) => str.includes(k))

export const getLatestDownloadAsset = async function ({
  bindings,
  platform,
  arch,
}: {
  bindings: Bindings
  platform: string
  arch: Arch
}): Promise<{
  filename?: string
  asset?: string
  ok: boolean
}> {
  if (!platform || !validatePlatform(platform)) {
    return {
      ok: false,
    }
  }

  const release: Releases | null = await getLatestRelease(bindings)

  if (!release) {
    return {
      ok: false,
    }
  }

  for (const asset of release.assets) {
    const { name, name: filename } = asset
    const findPlatform = checkPlatformDownloads(platform, arch, name)
    if (!findPlatform) {
      continue
    }

    const result = {
      filename,
      ok: true,
      asset: asset['browser_download_url'],
    }

    return result
  }

  return {
    ok: false,
  }
}

export default async function ({
  bindings,
  platform,
  version,
  rootUrl,
  arch,
}: {
  bindings: Bindings
  platform: string
  version: string
  rootUrl: string
  arch: Arch
}): Promise<Response> {
  // Make sure the platform is valid
  if (!platform || !validatePlatform(platform)) {
    return notFound()
  }

  // Make sure our version is semver valid
  if (!version || !semver.valid(version)) {
    return notFound()
  }

  const release: Releases | null = await getLatestRelease(bindings)

  if (!release) {
    return notFound()
  }

  // Sanitize our version
  const remoteVersion = sanitizeVersion(release.tag_name.toLowerCase())

  // Make sure we found a valid version
  if (!remoteVersion || !semver.valid(remoteVersion)) {
    return notFound()
  }

  // Check if the user is running older version or not
  const shouldUpdate = semver.gt(remoteVersion, version)
  if (!shouldUpdate) {
    return noUpdateAvailable()
  }

  for (const asset of release.assets) {
    const { name, name: filename } = asset
    const findPlatform = checkPlatform(platform, arch, name)
    if (!findPlatform) {
      console.log('Asset not found for', platform, arch, name)
      continue
    }

    // try to find signature for this asset
    const signature = await findAssetSignature(bindings, name, release.assets)

    const result = {
      name: release.tag_name,
      notes: release.body,
      pub_date: release.published_at,
      signature,
      url: `${rootUrl}/github/download-asset?${new URLSearchParams({
        asset: asset['browser_download_url'] as string,
        filename,
      }).toString()}`,
    }

    return json(result)
  }

  return notFound()
}

function sanitizeVersion(version: string): string {
  // if it start with v1.0.0 remove the `v`
  if (version.charAt(0) === 'v') {
    return version.substring(1)
  }

  return version
}

function getArch(fileName: string) {
  return fileName.includes('aarch64')
    ? 'aarch64'
    : fileName.includes('arm64')
    ? 'armv7'
    : hasKeywords(fileName, ['x64', 'amd64', 'win64'])
    ? 'x86_64'
    : hasKeywords(fileName, ['i686', 'win32', 'x32'])
    ? 'i686'
    : fileName.includes('universal')
    ? 'universal'
    : 'x86_64'
}

function checkPlatformDownloads(
  platform: string,
  arch: Arch,
  fileName: string
) {
  const extension = extname(fileName)
  const _arch = getArch(fileName)

  // OSX we should have our .dmg for MacOS downloads
  if (extension === 'dmg' && platform === AVAILABLE_PLATFORMS.Mac) {
    if (
      arch === _arch ||
      (_arch === 'aarch64' && arch === 'm1') ||
      (_arch === 'universal' && arch === 'universal')
    ) {
      return true
    }
  }

  // Windows we should have our .zip and setup for Windows downloads
  if (
    hasKeywords(fileName, ['setup', '.nsis']) &&
    (extension === 'zip' || extension === 'exe') &&
    platform === AVAILABLE_PLATFORMS.Windows
  ) {
    if (
      _arch === arch ||
      (_arch === 'x86_64' && arch === 'x64') ||
      (_arch === 'armv7' && arch === 'arm64')
    ) {
      return true
    }
  }
}

function checkPlatform(platform: string, arch: Arch, fileName: string) {
  const extension = extname(fileName)
  const _arch = getArch(fileName)

  // OSX we should have our .app tar.gz
  if (
    (hasKeywords(fileName, ['.app', 'darwin', 'osx']) &&
      extension === 'gz' &&
      platform === AVAILABLE_PLATFORMS.MacOS) ||
    platform === AVAILABLE_PLATFORMS.Mac
  ) {
    if (
      arch === _arch ||
      (arch === 'aarch64' && _arch === 'armv7') ||
      hasKeywords(fileName, ['universal'])
    ) {
      return 'darwin'
    }
  }

  // Windows
  if (
    hasKeywords(fileName, [
      'win64',
      'win32',
      'windows',
      '.msi',
      '.nsis',
      'setup',
    ]) &&
    extension === 'zip' &&
    platform === AVAILABLE_PLATFORMS.Windows
  ) {
    console.log('Checking Windows', fileName, arch, _arch)
    if (_arch === arch || 'aarch64' === arch) {
      return 'windows'
    }
  }

  // Linux app image
  if (
    fileName.includes('AppImage') &&
    extension === 'gz' &&
    platform === AVAILABLE_PLATFORMS.Linux
  ) {
    if (_arch === arch) {
      return 'linux'
    }
  }
}

function extname(filename: string) {
  return filename.split('.').pop() || ''
}

async function findAssetSignature(
  bindings: Bindings,
  fileName: string,
  assets: any[]
) {
  // check in our assets if we have a file: `fileName.sig`
  // by example fileName can be: App-1.0.0.zip
  const foundSignature = assets.find(
    (asset) => asset.name.toLowerCase() === `${fileName.toLowerCase()}.sig`
  )

  // console.log('Found Signature: ', foundSignature.browser_download_url)

  if (!foundSignature) {
    return null
  }

  const response = await fetchGitHubAsset(
    bindings,
    foundSignature.browser_download_url
  )
  if (!response.ok) {
    return null
  }
  const signature = await response.text()
  return signature
}
