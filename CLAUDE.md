# presentation-commander-server

Electron server app for the Presentation Commander system (pairs with presentation-commander-client). TypeScript, electron-vite. Uses native SDK links (see `clean:native-sdk-links`).

## Commands (npm)
- Dev: `npm run dev` (electron-vite dev)
- Typecheck: `npm run typecheck` (node + web)
- Lint / format: `npm run lint` · `npm run format`
- Build: `npm run build`
- Package: `npm run build:mac` · `:win` · `:linux` (each runs `clean:native-sdk-links` first, `--publish never`)

## Notes
- Packaging depends on `scripts/clean-native-sdk-links.js` — don't skip it in custom build steps (native SDK symlinks).
- Pairs with `presentation-commander-client`; keep their shared protocol in sync.
- "Commit" = commit **and** push.
