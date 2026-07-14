import { EventEmitter } from 'events'
import { NdiReceiver, type NdiFrame } from 'ndi-receive'

interface PreviewEntry {
  receiver: NdiReceiver
  stopped: boolean
}

/**
 * Live low-bandwidth NDI receive for scene-layer thumbnails. One receiver
 * per source id, driven by a self-scheduling loop rather than setInterval
 * so a slow/stalled capture can never overlap with the next one on the
 * same receiver instance (NDIlib_recv_capture_v3 is not meant to be
 * called concurrently from two threads on one receiver).
 *
 * Reference-counted per source id: the Viewer's edit-time preview and the
 * always-on StageDisplayCompositor can both be watching the same source
 * independently, so one of them stopping must not kill the receiver out
 * from under the other.
 */
class NdiPreviewService extends EventEmitter {
  private entries = new Map<string, PreviewEntry>()
  private refCounts = new Map<string, number>()

  start(sourceId: string, urlAddress: string): void {
    this.refCounts.set(sourceId, (this.refCounts.get(sourceId) ?? 0) + 1)
    if (this.entries.has(sourceId)) return
    const receiver = new NdiReceiver(urlAddress)
    const entry: PreviewEntry = { receiver, stopped: false }
    this.entries.set(sourceId, entry)
    this.loop(sourceId, entry)
  }

  stop(sourceId: string): void {
    const remaining = (this.refCounts.get(sourceId) ?? 1) - 1
    if (remaining > 0) {
      this.refCounts.set(sourceId, remaining)
      return
    }
    this.refCounts.delete(sourceId)
    const entry = this.entries.get(sourceId)
    if (!entry) return
    entry.stopped = true
    this.entries.delete(sourceId)
  }

  stopAll(): void {
    this.refCounts.clear()
    for (const id of [...this.entries.keys()]) {
      const entry = this.entries.get(id)
      if (!entry) continue
      entry.stopped = true
      this.entries.delete(id)
    }
  }

  private async loop(sourceId: string, entry: PreviewEntry): Promise<void> {
    while (!entry.stopped) {
      try {
        const frame: NdiFrame | null = await entry.receiver.captureFrame(1000)
        if (frame && !entry.stopped) this.emit('frame', sourceId, frame)
      } catch (err) {
        console.error(`[ndi-preview] capture failed for ${sourceId}:`, err)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    entry.receiver.destroy()
  }
}

export const ndiPreviewService = new NdiPreviewService()
