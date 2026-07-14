// Removes the space-free vendor-sdk symlinks created by each native
// package's resolve-sdk-dir.js before electron-builder packages the app —
// electron-builder refuses to package a symlink that resolves outside the
// project tree. Plain Node fs calls instead of `rm -rf native/*/vendor-sdk`
// so this also works under Windows CI, where shell glob expansion and rm
// aren't available.
const fs = require('fs')
const path = require('path')

const nativeDir = path.join(__dirname, '..', 'native')

if (fs.existsSync(nativeDir)) {
  for (const entry of fs.readdirSync(nativeDir)) {
    const linkPath = path.join(nativeDir, entry, 'vendor-sdk')
    if (fs.existsSync(linkPath)) {
      fs.rmSync(linkPath, { recursive: true, force: true })
    }
  }
}
