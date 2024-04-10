# PasteBar Updater Server

## Introduction

This worker fetches releases from PasteBarApp github repo

## Deploy

Run `npm run deploy` to deploy on Cloudflare Workers.

## Configure

Update the [endpoint](https://tauri.app/v1/guides/distribution/updater#tauri-configuration) in `tauri.config.json` to:

```
https://updater.pastebar.app/check/{{target}}/{{arch}}/{{current_version}}
```


## Assets Naming Pattern

- MacOSX: ends with `.app.tar.gz`
- Windows: ends with `.msi.zip` or `.nsis.zip`

## Development

```
npm install
npm run dev
```

```
npm run deploy
```

Based on https://github.com/egoist/tauri-updater (Thanks to @egoist)