// Domain types shared across main, preload, and renderer processes.

export type SourceKind = 'ndi' | 'web'

export interface NdiSource {
  kind: 'ndi'
  id: string
  name: string
  machineName: string
  /** Last observed frame rate reported over the NDI discovery service. */
  frameRate: number | null
  connected: boolean
}

export interface WebSource {
  kind: 'web'
  id: string
  name: string
  url: string
  /** Renders with alpha transparency for compositing (e.g. Stagetimer.io, Ontime overlays). */
  transparent: boolean
}

export type Source = NdiSource | WebSource

export type NewSourceInput =
  | { kind: 'ndi'; name: string; machineName: string }
  | { kind: 'web'; name: string; url: string; transparent: boolean }

export interface SceneLayer {
  id: string
  sourceId: string
  /** Percentage-based transform (0-100) relative to the compositor canvas. */
  x: number
  y: number
  width: number
  height: number
  visible: boolean
}

export interface Scene {
  id: string
  name: string
  /** Back of array renders on top. */
  layers: SceneLayer[]
}

export type OutputKind = 'decklink' | 'stream' | 'stage-display'

export interface MatrixOutput {
  id: string
  name: string
  kind: OutputKind
  /** id of a Source or a Scene currently routed to this output, or null if unrouted. */
  routedSourceId: string | null
}

export interface PresenterNote {
  slideIndex: number
  text: string
  receivedAt: number
}

export interface ClientNode {
  id: string
  name: string
  platform: 'windows' | 'macos'
  app: 'powerpoint' | 'keynote' | 'google-slides' | 'canva' | 'pdf'
  online: boolean
  lastSeen: number
  /** Set once a live Client Node has synced its deck; absent for mock/demo clients. */
  totalSlides?: number
}

export interface BroadcastMessage {
  text: string
  sentAt: number
}

export interface OrchestratorState {
  sources: Source[]
  scenes: Scene[]
  outputs: MatrixOutput[]
  clients: ClientNode[]
  notes: Record<string, PresenterNote[]>
  activeSlideIndex: Record<string, number>
  broadcastMessage: BroadcastMessage | null
}

/** Automation API surface exposed over OSC + JSON-RPC for Companion/Stream Deck control. */
export type AutomationCommand =
  | { type: 'route'; outputId: string; sourceId: string | null }
  | { type: 'blackout'; outputId: string }
  | { type: 'recall-preset'; outputId: string; sceneId: string }
  | { type: 'send-note'; message: string }
  | { type: 'next-slide'; clientId: string }
  | { type: 'previous-slide'; clientId: string }
