# Presentation Commander Server — Developing

Electron + React + TypeScript, built with electron-vite. Two native N-API addons link against
the official NDI SDK.

---

## 1. The rule that binds three repos

This is the **server** half of a three-repo system, and they **share a wire protocol that is
kept in sync by hand**:

| Repo | Role |
|---|---|
| **presentation-commander-server** (this) | Master control: routing, scenes, notes |
| [presentation-commander-client](https://github.com/allansargeant/presentation-commander-client) | Runs on the presentation laptop; bespoke PDF presentation engine |
| [companion-module-presentationcommander-server](https://github.com/allansargeant/companion-module-presentationcommander-server) | Bitfocus Companion module driving this server from a Stream Deck |

**When you touch the wire protocol, check all three.** A change to a message shape here can
break the presentation laptop mid-show, or silently stop a Stream Deck button working. The
Companion module is the one people forget, because it lives outside the pair.

The two contract files are [`src/shared/protocol.ts`](../src/shared/protocol.ts) (the
WebSocket messages) and the `AutomationCommand` union in
[`src/shared/types.ts`](../src/shared/types.ts) (what Companion POSTs). Both are documented in
[API.md](API.md).

## 2. What this software does, and what that implies

This drives what an audience sees. **A routing bug isn't a failed test — it's a black screen in
front of a room.**

- Prefer changes that **fail safe** (hold the last frame, keep the current route) over changes
  that fail open.
- The compositor and matrix router are **real-time paths**. Treat added latency or blocking work
  in them as a defect even when it is functionally correct.
- The README's posture — *review before relying on it in production* — is deliberate. Maintain
  it in any new user-facing text rather than quietly upgrading the claim.

---

## 3. Setup

```bash
npm install          # postinstall runs electron-builder install-app-deps
npm run dev          # electron-vite dev
```

### The NDI SDK is a build-time dependency

`native/ndi-receive` and `native/ndi-send` link against the
[Vizrt NDI SDK](https://ndi.video/for-developers/ndi-sdk/) — no third-party wrapper. Install it
before `npm install`.

- macOS default: `/Library/NDI SDK for Apple`
- Override with `NDI_SDK_DIR` if yours is elsewhere (Windows CI uses
  `C:\Program Files\NDI\NDI 6 SDK`)

`@electron/rebuild` rebuilds the addons automatically on install.

Each addon's `scripts/resolve-sdk-dir.js` creates a **space-free symlink** at
`native/<addon>/vendor-sdk` pointing at the SDK, because the default macOS path contains
spaces and node-gyp doesn't cope.

### ⚠ Packaging depends on `scripts/clean-native-sdk-links.js`. Don't skip it.

Those symlinks resolve **outside the project tree**, and **electron-builder refuses to package
such a symlink**. Every `build:mac` / `:win` / `:linux` script therefore removes them first.

If you write a custom build step and omit that call, packaging breaks in ways that don't
obviously point back at the cause. The script uses plain Node `fs` calls rather than
`rm -rf native/*/vendor-sdk` so it also works under Windows CI, where shell globbing isn't
available.

---

## 4. Scripts

```bash
npm run dev              # electron-vite dev
npm run typecheck        # BOTH tsconfigs — node and web
npm run lint             # eslint --cache
npm run format           # prettier --write .
npm run build            # typecheck + electron-vite build
npm run build:mac        # / :win / :linux
npm run build:unpack     # --dir, for inspecting the package
```

`typecheck` runs `tsconfig.node.json` **and** `tsconfig.web.json`. Main-process and renderer
code are separate projects; checking one proves nothing about the other.

**Two inconsistencies to be aware of:**

- **`build:mac` and `build:linux` skip the typecheck.** They call `electron-vite build`
  directly, where `build:win` and `build:unpack` go through `npm run build` (which typechecks
  first). Run `npm run typecheck` yourself before a mac or linux release.
- **There are no tests.** No test script, no test files. `typecheck` and `lint` are the only
  automated gates in this repo.

All packaging runs `--publish never`.

CI: `.github/workflows/build-windows.yml` (tag `v*` or manual) and `release.yml`.

---

## 5. Architecture

```
src/
  main/                    Electron main process
    index.ts                 window, IPC handler registration, service lifecycle
    services/
      ndiMatrix.ts           central state + executeCommand — the core
      clientHub.ts           WebSocket :9800 for Client Nodes
      automationApi.ts       HTTP :9700 for Companion
      ndiDiscovery.ts        mDNS browse for _ndi._tcp.local
      ndiPreview.ts          native receive → frames to the renderer
      ndiOutputSender.ts     coalescing wrapper around the native sender
  preload/index.ts         contextBridge surface
  renderer/src/            React UI
  shared/
    protocol.ts            wire protocol — mirrored in the client repo
    types.ts               domain model + AutomationCommand
native/
  ndi-receive/             N-API addon, NDIlib_recv_capture_v3
  ndi-send/                N-API addon
scripts/clean-native-sdk-links.js
```

`ndiMatrix` is an `EventEmitter` that emits `state-changed` with the **whole**
`OrchestratorState` after every mutation; `main/index.ts` forwards that to the renderer over
IPC. Its public interface (`getState` / `executeCommand` / the CRUD methods) is the seam — it
was written so swapping backing implementations wouldn't require touching callers.

**`executeCommand()` is shared by the in-app Control Surface and the HTTP automation API.**
Keep it that way: it is what makes a Stream Deck button and a click behave identically, rather
than by two implementations agreeing for now.

---

## 6. Current state of the implementation

Worth knowing before you plan work, and stated plainly in
[USER-GUIDE.md](USER-GUIDE.md) and [API.md](API.md) — **keep those in step if you change any of
it**:

| | Status |
|---|---|
| NDI discovery, receive, send | **Real**, against the official SDK |
| Scenes, layering, routing, notes, client hub | **Real**, in-app |
| **DeckLink / physical broadcast I/O** | **Not implemented** — out of scope, no hardware to test against |
| **Persistence** | **None.** All state is in-memory and lost on quit. |
| **Seed data** | `ndiMatrix.ts` starts with hardcoded demo sources, scenes, clients and notes |
| **Output list** | Hardcoded, four entries, no add/remove/rename API |
| **Tests** | None |
| **Auth** | None on `:9700` (loopback-only) or `:9800` (all interfaces) |

`ndiMatrix.ts`'s class comment describes the state as "backed by mock data until the native NDI
SDK bindings … are wired in". The **NDI half of that is now done** — receive and send are real.
What remains mock is the seed data and the DeckLink outputs.

Persistence is the most valuable missing piece: losing a built scene stack on quit is the
limitation an operator will hit first, and there is currently no way to prepare a show offline
or move a configuration between machines.

---

## 7. Traps

- **`registerClient` matches on `name`, not on any stable id.** That's what stops reconnects
  piling up duplicates, and it means two machines sharing a name collapse into one client. If
  you add a real client identity, this is the function to change.
- **Every registered client silently gets an auto-created source** (`client-src-<id>`, kind
  `ndi`). Removing it by hand doesn't stick — the next register recreates it.
- **`next-slide` / `previous-slide` have a silent local fallback.** If no client is connected,
  the server moves its own slide index over the slides it holds notes for and reports success.
  The caller cannot distinguish that from a real advance. Don't build anything on top of the
  return value.
- **`sources:remove` and `scenes:remove` cascade** — they clear routes and strip scene layers,
  with no confirmation and no undo.
- **`routedSourceId` holds either a source id or a scene id**, in one field. Any new routing
  code has to check both collections, as `route()` does.
- **Scene layer geometry is percentages (0–100), not pixels**, and **the last layer in the array
  is on top**.
- **The NDI sender must stay single-flight.** Two threadpool workers touching one sender
  instance concurrently is the failure the coalescing wrapper exists to prevent — don't
  "simplify" it into direct calls.
- **`ndi-output:toggle` is a toggle**, and ignores its `name` argument when already running.

---

## 8. Conventions

- "Commit" means commit **and** push.
- `CLAUDE.md` is the short command reference; [`AGENTS.md`](../AGENTS.md) is the model and the
  traps; this file is the developer detail.

---

## See also

- [API.md](API.md) — every interface, including what the automation API silently tolerates
- [USER-GUIDE.md](USER-GUIDE.md) — the operator view, including what's mock
- [README](../README.md) — install, architecture diagram, signing and Gatekeeper
