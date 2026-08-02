import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    // Vendored About dialog assets. Vite resolves publicDir against the
    // renderer's root (src/renderer), so it has to be named explicitly to keep
    // them at the repo root where sync-about.py writes them.
    publicDir: resolve('public'),
    define: {
      // The version the build produced. about-data.js carries one baked at sync
      // time as a fallback and it goes stale the moment a release is tagged;
      // this is the one that is always right. See public/about.js.
      __APP_VERSION__: JSON.stringify(`v${pkg.version}`)
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
