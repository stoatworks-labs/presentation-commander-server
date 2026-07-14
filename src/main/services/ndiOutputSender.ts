import { NdiSender } from 'ndi-send'

interface Frame {
  buffer: Buffer
  width: number
  height: number
}

/**
 * Thin coalescing wrapper around the native sender: only one NDIlib send
 * call is ever in flight at a time (queuing further calls from the same
 * JS process risks two threadpool workers touching the same sender
 * instance concurrently), and a 1s keep-alive resends the last frame so
 * a static composited frame doesn't go stale for receivers that expect a
 * steady feed.
 */
class NdiOutputSenderService {
  private sender: NdiSender | null = null
  private pending: Frame | null = null
  private lastSent: Frame | null = null
  private sending = false
  private keepAliveTimer: NodeJS.Timeout | null = null

  start(name: string): void {
    if (this.sender) return
    this.sender = new NdiSender(name)
    this.keepAliveTimer = setInterval(() => {
      if (this.lastSent) this.queue(this.lastSent)
    }, 1000)
  }

  isActive(): boolean {
    return this.sender !== null
  }

  sendFrame(buffer: Buffer, width: number, height: number): void {
    this.queue({ buffer, width, height })
  }

  stop(): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer)
    this.keepAliveTimer = null
    this.sender?.destroy()
    this.sender = null
    this.pending = null
    this.lastSent = null
  }

  private queue(frame: Frame): void {
    this.pending = frame
    this.lastSent = frame
    this.drain()
  }

  private drain(): void {
    if (this.sending || !this.pending || !this.sender) return
    const frame = this.pending
    this.pending = null
    this.sending = true
    this.sender
      .sendFrame(frame.buffer, frame.width, frame.height)
      .catch((err) => console.error('[ndi-output-sender] sendFrame failed:', err))
      .finally(() => {
        this.sending = false
        this.drain()
      })
  }
}

export const ndiOutputSenderService = new NdiOutputSenderService()
