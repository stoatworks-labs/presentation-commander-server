# Presentation Commander Server — Interfaces

Everything this app exposes to something outside itself, plus the internal IPC surface.

| § | Interface | Source |
|---|---|---|
| [1](#1-automation-api--http-9700) | Automation API — HTTP `:9700` | `src/main/services/automationApi.ts` |
| [2](#2-client-hub--websocket-9800) | Client Hub — WebSocket `:9800` | `src/main/services/clientHub.ts`, `src/shared/protocol.ts` |
| [3](#3-domain-model) | Domain model | `src/shared/types.ts` |
| [4](#4-ndi) | NDI discovery, receive and send | `src/main/services/ndi*.ts`, `native/` |
| [5](#5-ipc-channels) | Electron IPC channels | `src/main/index.ts`, `src/preload/index.ts` |

> **The protocol in §2 is shared across three repos** — this one,
> [presentation-commander-client](https://github.com/allansargeant/presentation-commander-client),
> and [companion-module-presentationcommander-server](https://github.com/allansargeant/companion-module-presentationcommander-server).
> It is kept in sync **by hand**. A change to a message shape here can break the presentation
> laptop mid-show, or silently stop a Stream Deck button working. The Companion module is the
> one people forget, because it lives outside the pair.

---

## 1. Automation API — HTTP `:9700`

Plain HTTP + JSON, for Bitfocus Companion / Stream Deck. It shares `executeCommand()` with the
in-app Control Surface panel, so both paths behave identically by construction.

**Bound to `127.0.0.1` only.** This is deliberate: the endpoint executes commands with **zero
authentication**, so exposing it to the network is a real security tradeoff the operator should
make explicitly — an SSH tunnel or a reverse proxy with auth — rather than something the app
defaults to. If Companion runs on a separate machine, see the Companion module's README.

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/state` | — | the full `OrchestratorState` (§3) |
| `POST` | `/rpc` | one `AutomationCommand` | `{"ok":true}` or `400 {"ok":false,"error":"…"}` |
| any | anything else | — | `404`, empty body |

There is no JSON-RPC envelope despite the name — `POST /rpc` takes a bare command object.

### Commands

```ts
{ type: 'route',         outputId: string, sourceId: string | null }
{ type: 'blackout',      outputId: string }
{ type: 'recall-preset', outputId: string, sceneId: string }
{ type: 'send-note',     message: string }
{ type: 'next-slide',     clientId: string }
{ type: 'previous-slide', clientId: string }
```

Things that are not obvious from the shapes:

- **`blackout` is `route` with `null`.** There is no separate blackout state to clear; to undo
  one, route the output back to something.
- **`recall-preset` routes a scene to *one* output.** It is not a global preset recall — it sets
  `outputId`'s route to `sceneId` and nothing else changes.
- **`route` validates.** An unknown `outputId`, or a `sourceId` that matches neither a source nor
  a scene, throws and comes back as `400`. `null` is always accepted.
- **`send-note` overwrites.** There is one `broadcastMessage` slot, not a queue; each call
  replaces the previous message. There is no clear command — send an empty string.
- **`next-slide` / `previous-slide` silently do two different things.** If the target client is
  connected to the hub, the command is **forwarded to it** over the WebSocket and the real deck
  advances. If it is not connected, the server **simulates locally**: it moves
  `activeSlideIndex` to the next slide index for which it holds a *note*, and nothing on any
  presentation laptop moves.

  That fallback is the one to watch on a show. A Stream Deck button will look like it worked —
  `{"ok":true}`, the number in the UI changes — while the projector doesn't move. If there are
  no notes for that client at all, the fallback does nothing whatsoever and still returns `ok`.
  There is no field in the response distinguishing the two paths; check the client's `online`
  flag in `GET /state`.

---

## 2. Client Hub — WebSocket `:9800`

A persistent connection per Client Node, so the server can push commands down and receive live
slide state up. Plain JSON, **one message per WebSocket frame**. Shapes are in
`src/shared/protocol.ts`.

> **Bound to `0.0.0.0` with no authentication of any kind.** Anything on the network can open a
> socket, register itself as a Client Node, and push slide state and presenter notes that the
> operator will see — and that a Notes source will composite onto a stage confidence monitor.
> There is no token, no allowlist and no TLS. Put this on a locked-down show network.

### Client → server

```ts
{ type: 'register', name: string, platform: 'windows'|'macos',
  app: 'powerpoint'|'keynote'|'google-slides'|'canva'|'pdf' }

{ type: 'slide-state', totalSlides: number, currentSlideIndex: number,
  notesBySlide: Record<number, string> }
```

### Server → client

```ts
{ type: 'registered', clientId: string }
{ type: 'command', command: { type: 'next-slide' } | { type: 'previous-slide' } }
```

### Behaviour

- **Malformed JSON is dropped silently.** No error frame, no close. A client sending bad frames
  looks identical to one sending nothing.
- **`slide-state` before `register` is ignored.** The handler requires a `clientId` from a prior
  registration on the same socket.
- **Registration matches on `name`.** An existing client with the same `name` is *reused* —
  its id, notes and history are kept and its platform/app are overwritten. This is what stops
  reconnects piling up duplicates, and it means **two different laptops with the same name
  collapse into one client**. Names must be unique across the rig.
- **Every registered client automatically becomes a routable source**, of kind `ndi`, named
  `"<name> (<app>)"`, with id `client-src-<clientId>`. You do not add it by hand, and removing
  it by hand will not stop it coming back on the next register.
- **`slide-state` replaces the whole note set** for that client. Notes are not merged, and every
  note's `receivedAt` is stamped at receive time — so timestamps reflect the last sync, not when
  a note was written.
- **On close**, the client is marked offline and its auto-source is marked disconnected. The
  client, its notes and its slide index all remain in state.
- The server never sends `registered` twice for one socket, and never pushes state — the
  renderer gets state over IPC, not over this socket.

---

## 3. Domain model

`OrchestratorState`, returned whole by `GET /state` and by `matrix:get-state`:

```ts
{
  sources: Source[]                          // ndi | web | notes
  scenes: Scene[]                            // layers, back of array renders on top
  outputs: MatrixOutput[]                    // decklink | stream | stage-display
  clients: ClientNode[]
  notes: Record<clientId, PresenterNote[]>
  activeSlideIndex: Record<clientId, number>
  broadcastMessage: { text, sentAt } | null
}
```

**Sources** are a discriminated union on `kind`:

| kind | Fields | Notes |
|---|---|---|
| `ndi` | `machineName`, `frameRate`, `connected`, `port?` | `port` is only set when added from network discovery, and it is what enables live receive. An NDI source added by typing a machine name has no port and will never preview. |
| `web` | `url`, `transparent` | `transparent: true` renders with alpha for overlays (timers, lower thirds). |
| `notes` | `clientId` | Renders that client's live current-slide presenter note as a text layer. |

**Scene layers** use **percentage** geometry (0–100) relative to the compositor canvas, not
pixels — so a scene is resolution-independent. **Back of the array renders on top**;
`bringLayerToFront` moves a layer to the end.

**Outputs** are `decklink`, `stream` or `stage-display`. `routedSourceId` holds the id of
*either* a Source or a Scene — the two id spaces share one field, which is why `route()` has to
check both lists.

### ⚠ Nothing here is persisted, and the output list is fixed

`NdiMatrixService` holds all of this **in memory**. There is no file, no database and no
autosave: **quitting the app discards every source, scene and route.** Next launch starts from
the same hardcoded seed data (§ USER-GUIDE).

The four outputs are **hardcoded in the service** and there is no API to add, remove or rename
one. `route`, `blackout` and `recall-preset` are the only output operations that exist.

---

## 4. NDI

Three separate things, with different levels of reality:

| | What it is | Real? |
|---|---|---|
| **Discovery** | mDNS browse for `_ndi._tcp.local` via `bonjour-service` | **Real.** Names, hosts and ports only — no video. |
| **Receive** | `native/ndi-receive`, N-API addon over the official Vizrt NDI SDK, `NDIlib_recv_capture_v3` | **Real.** Decoded frames drive the compositor's layer previews. |
| **Send** | `native/ndi-send`, same addon architecture | **Real.** One output: the composited confidence-monitor feed. |
| **DeckLink / physical broadcast I/O** | — | **Not implemented.** Out of scope; there is no hardware to test against. |

So an output of kind `decklink` is a routing destination in the state model and **nothing
comes out of a card**. Routing to it changes state and updates the UI. This is the single
biggest gap between what the interface implies and what the software does.

The sender is a **coalescing** wrapper: only one `NDIlib` send call is ever in flight (queuing
from the same JS process risks two threadpool workers touching one sender concurrently), and a
**1 s keep-alive resends the last frame**, so a static composited frame doesn't go stale for
receivers expecting a steady feed.

Building the addons requires the [NDI SDK](https://ndi.video/for-developers/ndi-sdk/) at build
time — see [DEVELOPING.md](DEVELOPING.md).

---

## 5. IPC channels

`contextBridge` surface from `src/preload/index.ts`; handlers in `src/main/index.ts`. Internal —
listed so a renderer change can be traced to its main-process handler.

**Invoked (`ipcRenderer.invoke`)**

| Channel | Args | Returns |
|---|---|---|
| `matrix:get-state` | — | `OrchestratorState` |
| `matrix:route` | `outputId, sourceId\|null` | — |
| `automation:execute` | `AutomationCommand` | — |
| `sources:add` | `NewSourceInput` | `Source` |
| `sources:update` | `id, patch` | — |
| `sources:remove` | `id` | — |
| `scenes:add` | `name` | `Scene` |
| `scenes:rename` | `id, name` | — |
| `scenes:remove` | `id` | — |
| `scenes:layer:add` | `sceneId, sourceId` | `SceneLayer` |
| `scenes:layer:update` | `sceneId, layerId, patch` | — |
| `scenes:layer:front` | `sceneId, layerId` | — |
| `scenes:layer:remove` | `sceneId, layerId` | — |
| `discovery:get-sources` | — | `DiscoveredNdiSource[]` |
| `ndi-preview:start` | `sourceId, host, port` | — |
| `ndi-preview:stop` | `sourceId` | — |
| `ndi-output:toggle` | `name` | `boolean` (new active state) |
| `ndi-output:is-active` | — | `boolean` |
| `ndi-output:push-frame` | `Uint8Array, width, height` | — |

**Pushed (main → renderer)**

| Channel | Payload |
|---|---|
| `matrix:state-changed` | `OrchestratorState` — emitted on **every** mutation |
| `discovery:changed` | `DiscoveredNdiSource[]` |
| `ndi-preview:frame` | `sourceId, frame` |

Two cascading deletes to know about, because neither asks and neither can be undone:

- **`sources:remove` clears every output routed to that source and strips every scene layer
  referencing it.** A source removed while on air blacks out its outputs.
- **`scenes:remove` clears every output routed to that scene.**

`ndi-output:toggle` is a **toggle**, not a setter: it ignores `name` when the sender is already
running and just stops it.

---

## See also

- [USER-GUIDE.md](USER-GUIDE.md) — operating it, and what's mock
- [DEVELOPING.md](DEVELOPING.md) — build, native addons, the three-repo rule
- [`src/shared/protocol.ts`](../src/shared/protocol.ts) — the wire protocol, authoritative
- [`src/shared/types.ts`](../src/shared/types.ts) — the domain model, authoritative
