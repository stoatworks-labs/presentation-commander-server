# Presentation Commander — Server

> **AI-assisted project.** This codebase was built with the help of
> [Claude](https://claude.ai), Anthropic's AI assistant — including
> architecture, implementation, and documentation. Review it accordingly
> before relying on it in production.

The master control application for live event production: an NDI-style matrix
router, OBS-style scene compositor, and presenter-notes hub, built as an
Electron + React + TypeScript desktop app.

Pairs with [presentation-commander-client](https://github.com/allansargeant/presentation-commander-client),
the companion app that runs on each presentation laptop.

![Presentation Commander Server main window: scene compositor, source pool, matrix inspector, control deck, and control surface](docs/screenshot.png)

## What it does

- **Source Pool** — add/edit/delete NDI and web sources, or pick a real NDI
  sender discovered live on the network (mDNS `_ndi._tcp.local`, no native
  SDK required for discovery)
- **Scenes** — OBS-style compositor: build scenes from multiple layered
  sources, drag to reposition, drag a corner to resize, toggle visibility
- **Matrix Inspector** — route any physical/stream/stage output to a source
  or a full composited scene
- **Control Deck** — live presenter notes and slide position per connected
  Client Node
- **Control Surface** — touchOSC-style button grid: scene recall, blackout,
  next/previous slide, send-note-to-stage — all backed by the same command
  path used by the JSON-RPC automation API (`:9700`) for Bitfocus
  Companion/Stream Deck integration
- **Client Hub** (`:9800`) — WebSocket server that Client Nodes register
  with; connected clients automatically appear as routable sources, and
  next/previous-slide commands are forwarded live to the client instead of
  being simulated locally

## What's real vs. mocked

NDI **source discovery** is real (mDNS), but this project does not receive
or send actual NDI video frames — that requires the native NDI SDK, which
isn't wired in. Routing, compositing, and outputs are all state/metadata
only, consistent with the rest of the app's approach to hardware it doesn't
have physical access to (DeckLink capture cards, real broadcast outputs).

## Project Setup

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
