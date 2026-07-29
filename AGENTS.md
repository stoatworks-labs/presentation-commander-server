# AGENTS.md — bringing an LLM up to speed on Presentation Commander (Server)

Orientation for an AI assistant (or a new human) picking this project up cold. `CLAUDE.md`
holds the short command reference; this file explains the model and the traps.

---

## 1. What this is

The **master control application for live event production**: a real-time **NDI video matrix
router**, a **layered scene compositor**, and a **presenter-notes hub**. Electron + React +
TypeScript desktop app.

This is the **server** half of a three-repo system.

## 2. The three repos, and the rule that binds them

| Repo | Role |
|---|---|
| **presentation-commander-server** (this) | Master control: routing, scenes, notes |
| **presentation-commander-client** | Runs on the presentation laptop; bespoke PDF presentation engine |
| **companion-module-presentationcommander-server** | Bitfocus Companion module driving this server from a Stream Deck |

**They share a protocol, and it must stay in sync across all three.** A change to a message
shape here can break the presentation laptop mid-show, or silently stop a Stream Deck button
working. When you touch the wire protocol, check all three repos — the Companion module is
easy to forget because it lives outside the pair.

## 3. Build traps — read before packaging

**Packaging depends on `scripts/clean-native-sdk-links.js`. Don't skip it.**

Every `build:mac` / `:win` / `:linux` script runs it first, because this app uses **native
SDK symlinks** (NDI). If you write a custom build step and omit it, packaging breaks in ways
that don't obviously point back at the cause.

All packaging runs `--publish never`.

```bash
npm run dev          # electron-vite dev
npm run typecheck    # node + web - covers both tsconfigs
npm run lint         # / npm run format
npm run build
npm run build:mac    # / :win / :linux
```

## 4. What "live event production" implies for how you work

This drives what an audience sees. A routing bug isn't a failed test — it's a black screen in
front of a room. Prefer changes that fail safe (hold last frame, keep current route) over
changes that fail open.

The compositor and matrix router are real-time paths; treat added latency or blocking work in
them as a defect even when it's functionally correct.

## 5. Status

Review before relying on it in production — the README says so explicitly and that posture
should be maintained in any new user-facing text.

## 6. Conventions

- "Commit" means commit **and** push.

## Diagnostics

Log via `say`/`log` from `src/main/diag/`, never `console`. `installElectronDiagnostics()`
hooks `render-process-gone` and `child-process-gone` — a dead renderer raises nothing the
main process's `uncaughtException` handler can see. `diag:collect` and `diag:openLogFolder`
are registered over IPC but **no UI calls them yet**; wiring a button is outstanding.
See [docs/diagnostics.md](docs/diagnostics.md).
