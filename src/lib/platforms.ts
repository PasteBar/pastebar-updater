export enum AVAILABLE_PLATFORMS {
  MacOS = 'darwin',
  Mac = 'mac',
  Windows = 'windows',
  Linux = 'linux',
}

export function validatePlatform(platform: string): string | undefined {
  switch (platform) {
    case AVAILABLE_PLATFORMS.MacOS:
    case AVAILABLE_PLATFORMS.Mac:
    case AVAILABLE_PLATFORMS.Windows:
    case AVAILABLE_PLATFORMS.Linux:
      return platform
  }
}
