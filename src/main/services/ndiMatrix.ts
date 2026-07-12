import { EventEmitter } from 'events'
import type { ClientNode, MatrixOutput, PresenterNote, Source } from '../../shared/types'

/**
 * Central router state. Backed by mock data until the native NDI SDK
 * bindings (grandiose / NDI Advanced SDK) and OS-level DeckLink drivers
 * are wired in. The public interface (getState/route/*) is what the rest
 * of the app depends on, so swapping the mock for real NDI discovery
 * later shouldn't require touching callers.
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

  private outputs: MatrixOutput[] = [
    {
      id: 'out-decklink-1',
      name: 'DeckLink 1 — Program',
      kind: 'decklink',
      routedSourceId: 'ndi-1'
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

  getState(): {
    sources: Source[]
    outputs: MatrixOutput[]
    clients: ClientNode[]
    notes: Record<string, PresenterNote[]>
  } {
    return {
      sources: this.sources,
      outputs: this.outputs,
      clients: this.clients,
      notes: this.notes
    }
  }

  route(outputId: string, sourceId: string | null): void {
    const output = this.outputs.find((o) => o.id === outputId)
    if (!output) throw new Error(`Unknown output: ${outputId}`)
    if (sourceId && !this.sources.some((s) => s.id === sourceId)) {
      throw new Error(`Unknown source: ${sourceId}`)
    }
    output.routedSourceId = sourceId
    this.emit('state-changed', this.getState())
  }
}

export const ndiMatrix = new NdiMatrixService()
