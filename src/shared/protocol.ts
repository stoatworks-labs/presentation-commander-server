// Wire protocol between the Master Server's client hub (ws://0.0.0.0:9800)
// and a Client Node. Kept as plain JSON messages, one per WebSocket frame.
// Mirrored in the livemaster-client-node repo — keep both in sync by hand.

export type ClientPlatform = 'windows' | 'macos'
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
