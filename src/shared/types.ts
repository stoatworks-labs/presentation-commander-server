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

export type OutputKind = 'decklink' | 'stream' | 'stage-display'

export interface MatrixOutput {
  id: string
  name: string
  kind: OutputKind
  /** id of the Source currently routed to this output, or null if unrouted. */
  routedSourceId: string | null
}

export interface PresenterNote {
  slideIndex: number
  text: string
  receivedAt: number
}

export interface SlideDeckState {
  clientId: string
  clientName: string
  totalSlides: number
  currentSlideIndex: number
  notesBySlide: Record<number, string>
}

export interface ClientNode {
  id: string
  name: string
  platform: 'windows' | 'macos'
  app: 'powerpoint' | 'keynote' | 'google-slides' | 'canva' | 'pdf'
  online: boolean
  lastSeen: number
}

/** Automation API surface exposed over OSC + JSON-RPC for Companion/Stream Deck control. */
export type AutomationCommand =
  | { type: 'route'; outputId: string; sourceId: string }
  | { type: 'recall-preset'; presetId: string }
  | { type: 'send-note'; message: string }
  | { type: 'next-slide'; clientId: string }
  | { type: 'previous-slide'; clientId: string }
