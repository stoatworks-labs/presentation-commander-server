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
 * Central router state. Backed by mock data until the native NDI SDK
 * bindings (grandiose / NDI Advanced SDK) and OS-level DeckLink drivers
 * are wired in. The public interface (getState/executeCommand/CRUD
 * methods) is what the rest of the app depends on, so swapping the mock
 * for real NDI discovery later shouldn't require touching callers.
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
    const source: Source =
      input.kind === 'ndi'
        ? {
            kind: 'ndi',
            id,
            name: input.name,
            machineName: input.machineName,
            frameRate: null,
            connected: false
          }
        : { kind: 'web', id, name: input.name, url: input.url, transparent: input.transparent }
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

  /** Reuses the existing client id for a matching name so reconnects don't pile up duplicates. */
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
        if (this.commandForwarder?.(command.clientId, { type: command.type })) return
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
