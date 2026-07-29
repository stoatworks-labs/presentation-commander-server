import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import type {
  AutomationCommand,
  BroadcastMessage,
  ClientNode,
  MatrixOutput,
  NewSourceInput,
  OrchestratorState,
  PresenterNote,
  Scene,
  SceneLayer,
  Source
} from '../../shared/types'

/**
 * Central router state: the single owner of sources, scenes, outputs, clients
 * and notes. Everything else — the renderer, the automation API, the client
 * hub — reads through getState() and mutates through the CRUD methods or
 * executeCommand(), and gets told about changes by the 'state-changed' event.
 *
 * The public interface (getState/executeCommand/CRUD) is deliberately the only
 * contact surface, so the backing implementation can change without touching
 * callers. That has already paid off once: NDI is no longer mocked.
 *
 * WHAT IS AND ISN'T REAL, as of now:
 *  - NDI discovery, receive and send are REAL (see ndiDiscovery / ndiPreview /
 *    ndiOutputSender, over the official Vizrt SDK).
 *  - DeckLink and other physical broadcast I/O are NOT implemented and are out
 *    of scope. An output of kind 'decklink' is a routing destination in this
 *    model and nothing comes out of a card.
 *  - The seed data below (three NDI sources, two web sources, two scenes, two
 *    clients with notes) is DEMO DATA. It is not discovered and none of it
 *    exists on any network. An operator will see it on first launch.
 *
 * NOTHING HERE IS PERSISTED. All state is in memory, so quitting the app
 * discards every source, scene and route the operator built and the next
 * launch starts from the seed data again. That is the limitation users hit
 * first; see docs/USER-GUIDE.md.
 */
class NdiMatrixService extends EventEmitter {
  private sources: Source[] = [
    {
      kind: 'ndi',
      id: 'ndi-1',
      name: 'LAPTOP-STAGE-L (PowerPoint)',
      machineName: 'STAGE-L',
      frameRate: 60,
      connected: true
    },
    {
      kind: 'ndi',
      id: 'ndi-2',
      name: 'LAPTOP-STAGE-R (Keynote)',
      machineName: 'STAGE-R',
      frameRate: 60,
      connected: true
    },
    {
      kind: 'ndi',
      id: 'ndi-3',
      name: 'BOOTH-01 (PDF Engine)',
      machineName: 'BOOTH-01',
      frameRate: 60,
      connected: false
    },
    {
      kind: 'web',
      id: 'web-1',
      name: 'Stagetimer.io Countdown',
      url: 'https://stagetimer.io/',
      transparent: true
    },
    {
      kind: 'web',
      id: 'web-2',
      name: 'Ontime Overlay',
      url: 'https://ontime.gg/',
      transparent: true
    }
  ]

  private scenes: Scene[] = [
    {
      id: 'scene-main',
      name: 'Main Program',
      layers: [
        { id: 'layer-1', sourceId: 'ndi-1', x: 0, y: 0, width: 100, height: 100, visible: true },
        { id: 'layer-2', sourceId: 'web-1', x: 68, y: 68, width: 28, height: 28, visible: true }
      ]
    },
    {
      id: 'scene-cam-only',
      name: 'Speaker Only',
      layers: [
        { id: 'layer-3', sourceId: 'ndi-2', x: 0, y: 0, width: 100, height: 100, visible: true }
      ]
    }
  ]

  private outputs: MatrixOutput[] = [
    {
      id: 'out-decklink-1',
      name: 'DeckLink 1 — Program',
      kind: 'decklink',
      routedSourceId: 'scene-main'
    },
    {
      id: 'out-decklink-2',
      name: 'DeckLink 2 — Preview',
      kind: 'decklink',
      routedSourceId: 'ndi-2'
    },
    { id: 'out-stream-1', name: 'Stream Output', kind: 'stream', routedSourceId: null },
    {
      id: 'out-stage-1',
      name: 'Confidence Monitor',
      kind: 'stage-display',
      routedSourceId: 'ndi-1'
    }
  ]

  private clients: ClientNode[] = [
    {
      id: 'client-1',
      name: 'STAGE-L',
      platform: 'windows',
      app: 'powerpoint',
      online: true,
      lastSeen: Date.now()
    },
    {
      id: 'client-2',
      name: 'STAGE-R',
      platform: 'macos',
      app: 'keynote',
      online: true,
      lastSeen: Date.now()
    }
  ]

  private notes: Record<string, PresenterNote[]> = {
    'client-1': [
      { slideIndex: 1, text: 'Welcome the audience, hold for applause.', receivedAt: Date.now() },
      { slideIndex: 2, text: 'Advance on cue from stage manager.', receivedAt: Date.now() }
    ]
  }

  private activeSlideIndex: Record<string, number> = { 'client-1': 1 }

  private broadcastMessage: BroadcastMessage | null = null

  /** Registered by the client hub once it's listening; lets executeCommand hand
   *  next/previous-slide to a live Client Node instead of mutating state locally. */
  private commandForwarder:
    | ((clientId: string, command: { type: 'next-slide' } | { type: 'previous-slide' }) => boolean)
    | null = null

  getState(): OrchestratorState {
    return {
      sources: this.sources,
      scenes: this.scenes,
      outputs: this.outputs,
      clients: this.clients,
      notes: this.notes,
      activeSlideIndex: this.activeSlideIndex,
      broadcastMessage: this.broadcastMessage
    }
  }

  private publish(): void {
    this.emit('state-changed', this.getState())
  }

  // --- Sources -------------------------------------------------------

  addSource(input: NewSourceInput): Source {
    const id = `${input.kind}-${randomUUID().slice(0, 8)}`
    let source: Source
    if (input.kind === 'ndi') {
      source = {
        kind: 'ndi',
        id,
        name: input.name,
        machineName: input.machineName,
        frameRate: null,
        connected: input.port !== undefined,
        port: input.port
      }
    } else if (input.kind === 'web') {
      source = { kind: 'web', id, name: input.name, url: input.url, transparent: input.transparent }
    } else {
      source = { kind: 'notes', id, name: input.name, clientId: input.clientId }
    }
    this.sources.push(source)
    this.publish()
    return source
  }

  updateSource(id: string, patch: Partial<Omit<Source, 'kind' | 'id'>>): void {
    const source = this.sources.find((s) => s.id === id)
    if (!source) throw new Error(`Unknown source: ${id}`)
    Object.assign(source, patch)
    this.publish()
  }

  /**
   * Delete a source, and cascade: any output routed to it is unrouted, and it
   * is stripped out of every scene that used it.
   *
   * The cascade is deliberate — leaving a dangling id would make an output
   * point at nothing while still claiming to be routed — but it means this is
   * DESTRUCTIVE AND IMMEDIATE. There is no confirmation and no undo, and
   * deleting a source that is on air blacks out its outputs. Callers that
   * expose this to an operator should say so.
   */
  removeSource(id: string): void {
    this.sources = this.sources.filter((s) => s.id !== id)
    for (const output of this.outputs) {
      if (output.routedSourceId === id) output.routedSourceId = null
    }
    for (const scene of this.scenes) {
      scene.layers = scene.layers.filter((layer) => layer.sourceId !== id)
    }
    this.publish()
  }

  // --- Scenes ----------------------------------------------------------

  addScene(name: string): Scene {
    const scene: Scene = { id: `scene-${randomUUID().slice(0, 8)}`, name, layers: [] }
    this.scenes.push(scene)
    this.publish()
    return scene
  }

  renameScene(id: string, name: string): void {
    const scene = this.getScene(id)
    scene.name = name
    this.publish()
  }

  /** Delete a scene, unrouting any output pointing at it. Same immediacy
   *  caveat as removeSource(). */
  removeScene(id: string): void {
    this.scenes = this.scenes.filter((s) => s.id !== id)
    for (const output of this.outputs) {
      if (output.routedSourceId === id) output.routedSourceId = null
    }
    this.publish()
  }

  addLayer(sceneId: string, sourceId: string): SceneLayer {
    const scene = this.getScene(sceneId)
    if (!this.sources.some((s) => s.id === sourceId)) throw new Error(`Unknown source: ${sourceId}`)
    const layer: SceneLayer = {
      id: `layer-${randomUUID().slice(0, 8)}`,
      sourceId,
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      visible: true
    }
    scene.layers.push(layer)
    this.publish()
    return layer
  }

  updateLayer(
    sceneId: string,
    layerId: string,
    patch: Partial<Omit<SceneLayer, 'id' | 'sourceId'>>
  ): void {
    const scene = this.getScene(sceneId)
    const layer = scene.layers.find((l) => l.id === layerId)
    if (!layer) throw new Error(`Unknown layer: ${layerId}`)
    Object.assign(layer, patch)
    this.publish()
  }

  bringLayerToFront(sceneId: string, layerId: string): void {
    const scene = this.getScene(sceneId)
    const index = scene.layers.findIndex((l) => l.id === layerId)
    if (index === -1) throw new Error(`Unknown layer: ${layerId}`)
    const [layer] = scene.layers.splice(index, 1)
    scene.layers.push(layer)
    this.publish()
  }

  removeLayer(sceneId: string, layerId: string): void {
    const scene = this.getScene(sceneId)
    scene.layers = scene.layers.filter((l) => l.id !== layerId)
    this.publish()
  }

  private getScene(id: string): Scene {
    const scene = this.scenes.find((s) => s.id === id)
    if (!scene) throw new Error(`Unknown scene: ${id}`)
    return scene
  }

  // --- Client hub --------------------------------------------------------

  setCommandForwarder(
    fn: (clientId: string, command: { type: 'next-slide' } | { type: 'previous-slide' }) => boolean
  ): void {
    this.commandForwarder = fn
  }

  /**
   * Register (or re-register) a Client Node and return its id.
   *
   * Identity is the client's NAME. A registration matching an existing name
   * reuses that client — keeping its id, notes and slide index, overwriting
   * its platform/app — which is what stops a flaky network from filling the
   * list with duplicates on every reconnect.
   *
   * The cost of keying on name: TWO DIFFERENT LAPTOPS SHARING A NAME COLLAPSE
   * INTO ONE CLIENT, silently, and their slide state lands on the same entry.
   * Rigs need unique machine names. If a stable per-machine id ever arrives
   * over the wire, this is the function to change.
   */
  registerClient(info: Pick<ClientNode, 'name' | 'platform' | 'app'>): string {
    const existing = this.clients.find((c) => c.name === info.name)
    if (existing) {
      existing.platform = info.platform
      existing.app = info.app
      existing.online = true
      existing.lastSeen = Date.now()
      this.upsertClientSource(existing.id, info.name, info.app, true)
      this.publish()
      return existing.id
    }
    const id = `live-${randomUUID().slice(0, 8)}`
    this.clients.push({
      id,
      name: info.name,
      platform: info.platform,
      app: info.app,
      online: true,
      lastSeen: Date.now()
    })
    this.upsertClientSource(id, info.name, info.app, true)
    this.publish()
    return id
  }

  setClientOnline(id: string, online: boolean): void {
    const client = this.clients.find((c) => c.id === id)
    if (!client) return
    client.online = online
    client.lastSeen = Date.now()
    const source = this.sources.find((s) => s.id === this.clientSourceId(id))
    if (source && source.kind === 'ndi') source.connected = online
    this.publish()
  }

  /** Every connected Client Node shows up as a routable NDI-kind source automatically. */
  private clientSourceId(clientId: string): string {
    return `client-src-${clientId}`
  }

  private upsertClientSource(
    clientId: string,
    name: string,
    app: ClientNode['app'],
    connected: boolean
  ): void {
    const id = this.clientSourceId(clientId)
    const existing = this.sources.find((s) => s.id === id)
    if (existing && existing.kind === 'ndi') {
      existing.name = `${name} (${app})`
      existing.machineName = name
      existing.connected = connected
      return
    }
    this.sources.push({
      kind: 'ndi',
      id,
      name: `${name} (${app})`,
      machineName: name,
      frameRate: null,
      connected
    })
  }

  syncSlideState(
    clientId: string,
    state: { totalSlides: number; currentSlideIndex: number; notesBySlide: Record<number, string> }
  ): void {
    const client = this.clients.find((c) => c.id === clientId)
    if (!client) return
    client.totalSlides = state.totalSlides
    client.lastSeen = Date.now()
    this.notes[clientId] = Object.entries(state.notesBySlide).map(([slideIndex, text]) => ({
      slideIndex: Number(slideIndex),
      text,
      receivedAt: Date.now()
    }))
    this.activeSlideIndex[clientId] = state.currentSlideIndex
    this.publish()
  }

  // --- Routing & automation --------------------------------------------

  route(outputId: string, routedId: string | null): void {
    const output = this.outputs.find((o) => o.id === outputId)
    if (!output) throw new Error(`Unknown output: ${outputId}`)
    if (
      routedId &&
      !this.sources.some((s) => s.id === routedId) &&
      !this.scenes.some((s) => s.id === routedId)
    ) {
      throw new Error(`Unknown source or scene: ${routedId}`)
    }
    output.routedSourceId = routedId
    this.publish()
  }

  executeCommand(command: AutomationCommand): void {
    switch (command.type) {
      case 'route':
        this.route(command.outputId, command.sourceId)
        return
      case 'blackout':
        this.route(command.outputId, null)
        return
      case 'recall-preset':
        this.route(command.outputId, command.sceneId)
        return
      case 'send-note':
        this.broadcastMessage = { text: command.message, sentAt: Date.now() }
        this.publish()
        return
      case 'next-slide':
      case 'previous-slide': {
        // Preferred path: hand it to the live Client Node and let the real
        // deck advance. The forwarder returns false when that client has no
        // open socket.
        if (this.commandForwarder?.(command.clientId, { type: command.type })) return

        // Fallback when no client is connected: step our OWN idea of the
        // slide index across the slides we happen to hold notes for.
        //
        // Be clear about what this is. Nothing on any presentation laptop
        // moves — only the number the console displays. executeCommand()
        // returns void either way, so the caller (a Stream Deck button via
        // the automation API, or the in-app Control Surface) cannot tell the
        // two paths apart and will report success regardless. With no notes
        // for that client it does nothing at all, still reporting success.
        //
        // The honest signal is the client's `online` flag in getState(). If
        // this ever needs to be distinguishable, the return type has to
        // change — every caller currently ignores it.
        const slides = (this.notes[command.clientId] ?? [])
          .map((n) => n.slideIndex)
          .sort((a, b) => a - b)
        if (slides.length === 0) return
        const current = this.activeSlideIndex[command.clientId] ?? slides[0]
        const currentPos = slides.indexOf(current)
        const delta = command.type === 'next-slide' ? 1 : -1
        const nextPos = Math.min(Math.max(currentPos + delta, 0), slides.length - 1)
        this.activeSlideIndex[command.clientId] = slides[nextPos]
        this.publish()
        return
      }
    }
  }
}

export const ndiMatrix = new NdiMatrixService()
