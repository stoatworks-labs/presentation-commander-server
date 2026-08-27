// Wire protocol between the Master Server's client hub (ws://0.0.0.0:9800)
// and a Client Node. Kept as plain JSON messages, one per WebSocket frame.
// Mirrored in the presentation-commander-client repo — keep both in sync by hand.

// Both apps are packaged for Linux, but the client used to report every Linux
// box as 'windows' — it derived this from a two-way darwin/else test, so the
// Control Deck and the automation API both showed the wrong platform. The hub
// does not validate the value, so an older server still accepts 'linux'.
export type ClientPlatform = 'windows' | 'macos' | 'linux'
export type ClientApp = 'powerpoint' | 'keynote' | 'google-slides' | 'canva' | 'pdf'

export interface RegisterMessage {
  type: 'register'
  name: string
  platform: ClientPlatform
  app: ClientApp
}

export interface SlideStateMessage {
  type: 'slide-state'
  totalSlides: number
  currentSlideIndex: number
  notesBySlide: Record<number, string>
}

export type ClientToServerMessage = RegisterMessage | SlideStateMessage

export interface RegisteredMessage {
  type: 'registered'
  clientId: string
}

export interface RemoteCommandMessage {
  type: 'command'
  command: { type: 'next-slide' } | { type: 'previous-slide' }
}

export type ServerToClientMessage = RegisteredMessage | RemoteCommandMessage
