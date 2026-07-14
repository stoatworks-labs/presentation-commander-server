// Prints the NDI SDK directory to stdout for binding.gyp to consume as a
// gyp variable. gyp/make choke on the spaces in the SDK's default macOS
// install path ("/Library/NDI SDK for Apple"), so on macOS we mirror it
// through a space-free symlink inside this package and hand gyp that
// instead. Override with NDI_SDK_DIR if the SDK lives somewhere else.
const fs = require('fs')
const path = require('path')

const packageRoot = path.resolve(__dirname, '..')
const linkPath = path.join(packageRoot, 'vendor-sdk')

function fail(message) {
  console.error(`[ndi-send] ${message}`)
  process.exit(1)
}

if (process.env.NDI_SDK_DIR) {
  process.stdout.write(process.env.NDI_SDK_DIR)
  process.exit(0)
}

if (process.platform === 'darwin') {
  const defaultPath = '/Library/NDI SDK for Apple'
  if (!fs.existsSync(defaultPath)) {
    fail(
      `NDI SDK not found at "${defaultPath}". Install it from https://ndi.video/for-developers/ndi-sdk/ or set NDI_SDK_DIR.`
    )
  }
  try {
    if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath)
    fs.symlinkSync(defaultPath, linkPath)
  } catch (err) {
    fail(`Could not create symlink at ${linkPath}: ${err.message}`)
  }
  process.stdout.write(linkPath)
  process.exit(0)
}

if (process.platform === 'linux') {
  const candidates = ['/usr/include/ndi', '/usr/local/include/ndi', '/opt/ndi']
  const found = candidates.find((p) => fs.existsSync(p))
  if (!found) {
    fail(`NDI SDK not found in any of: ${candidates.join(', ')}. Set NDI_SDK_DIR.`)
  }
  process.stdout.write(found)
  process.exit(0)
}

if (process.platform === 'win32') {
  const candidates = ['C:\\Program Files\\NDI\\NDI 6 SDK', 'C:\\Program Files\\NDI\\NDI 5 SDK']
  const found = candidates.find((p) => fs.existsSync(p))
  if (!found) {
    fail(`NDI SDK not found in any of: ${candidates.join(', ')}. Set NDI_SDK_DIR.`)
  }
  process.stdout.write(found)
  process.exit(0)
}

fail(`Unsupported platform: ${process.platform}`)
