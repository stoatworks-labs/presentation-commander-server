# Presentation Commander — Server

> **AI-assisted project.** This codebase was created with [Claude](https://claude.com/claude-code)
> (Anthropic), directed and reviewed by a human author — including architecture,
> implementation, and documentation. Review it accordingly before relying on it in
> production.

The master control application for live event production: a real-time NDI
video matrix router, layered scene compositor, and presenter-notes hub,
built as an Electron + React + TypeScript desktop app.

Pairs with [presentation-commander-client](https://github.com/allansargeant/presentation-commander-client),
the companion app that runs on each presentation laptop.

![Presentation Commander Server main window: scene compositor, source pool, matrix inspector, control deck, and control surface](docs/screenshot.png)

## What it does

- **Source Pool** — add/edit/delete NDI and web sources, or pick a real NDI
  sender discovered live on the network (mDNS `_ndi._tcp.local`)
- **Scenes** — layered scene compositor: build scenes from multiple layered
  sources, drag to reposition, drag a corner to resize, toggle visibility.
  Layers backed by a real network source show a **live video preview**
  rendered from actual received NDI frames, not a placeholder box
- **Matrix Inspector** — route any physical/stream/stage output to a source
  or a full composited scene
- **Control Deck** — live presenter notes and slide position per connected
  Client Node
- **Control Surface** — a button-grid control surface: scene recall, blackout,
  next/previous slide, send-note-to-stage — all backed by the same command
  path used by the JSON-RPC automation API (`:9700`), which also powers the
  [Bitfocus Companion module](https://github.com/allansargeant/companion-module-presentationcommander-server)
  for Stream Deck integration
- **Confidence Monitor** — a `Presenter Notes` source type composites live
  presenter notes over video into one real NDI output (`native/ndi-send`,
  the same addon architecture as the Client's NDI send), so a physical
  stage monitor gets an actual broadcast signal instead of a text box in
  the operator's own window
- **Client Hub** (`:9800`) — WebSocket server that Client Nodes register
  with; connected clients automatically appear as routable sources, and
  next/previous-slide commands are forwarded live to the client instead of
  being simulated locally

## Architecture

```mermaid
graph LR
    subgraph laptop["Presentation Laptop (Client Node)"]
        SS["SlideSource<br/>PDF · Keynote · Google Slides"]
        NDIsend["NDI Send<br/>native/ndi-send"]
        ProgOut["Program Out window"]
        SL["serverLink.ts"]
        SS --> NDIsend
        SS --> ProgOut
        SS --> SL
    end

    subgraph browser["Browser (optional)"]
        GSExt["Google Slides<br/>MV3 extension"]
    end
    GSExt -- "ws://localhost:9801" --> SL

    subgraph server["Master Server"]
        Hub["Client Hub<br/>WS :9800"]
        Matrix["NDI Matrix /<br/>Scene Compositor"]
        Auto["Automation API<br/>HTTP :9700"]
        ConfMon["Confidence Monitor<br/>NDI Send"]
        Hub --> Matrix
        Matrix --> ConfMon
        Auto --> Matrix
    end
    SL -- "register / slide-state / command" --> Hub

    NDIsend -- "NDI network" --> Matrix
    ConfMon -- "NDI network" --> Monitor["Physical stage<br/>confidence monitor"]

    Companion["Bitfocus Companion<br/>module"] -- "GET /state, POST /rpc" --> Auto
    Deck["Stream Deck / any<br/>Companion surface"] --> Companion
```

## What's real vs. mocked

NDI **discovery and receive are real**, built directly against the official
[Vizrt NDI SDK](https://ndi.video/for-developers/ndi-sdk/) via a small
native N-API addon (`native/ndi-receive`) — no third-party NDI wrapper.
Source discovery uses mDNS; the scene compositor's layer previews are
actual decoded video frames pulled from the network with
`NDIlib_recv_capture_v3`. DeckLink capture cards and other physical
broadcast hardware are still out of scope — this project has no way to
test against hardware it doesn't have.

### Building from source

The native receive addon links against the NDI SDK at build time. Install
the [NDI SDK](https://ndi.video/for-developers/ndi-sdk/) first (macOS
default: `/Library/NDI SDK for Apple`; override the location with
`NDI_SDK_DIR` if yours lives elsewhere). `npm install` rebuilds the addon
automatically via `@electron/rebuild`.

## Roadmap / TODO

- [ ] **Physical capture hardware** — DeckLink capture cards and other broadcast I/O are currently out of scope; the project has no way to test against hardware it doesn't have. NDI discovery/receive and the compositor are real (see "What's real vs. mocked" above).

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
