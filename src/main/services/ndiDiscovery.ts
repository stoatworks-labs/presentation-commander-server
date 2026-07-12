import { Bonjour, Service } from 'bonjour-service'
import { EventEmitter } from 'events'
import type { DiscoveredNdiSource } from '../../shared/types'

type NdiService = InstanceType<typeof Service>

/**
 * Real network discovery of NDI senders via mDNS (_ndi._tcp.local), the
 * same mechanism NDI itself uses to advertise sources. This finds names
 * and addresses only — it does not receive video frames, which would
 * require the native NDI SDK. Good enough to populate a real "what's on
 * the network right now" picker instead of typing a machine name.
 */
class NdiDiscoveryService extends EventEmitter {
  private bonjour: InstanceType<typeof Bonjour> | null = null
  private sources = new Map<string, DiscoveredNdiSource>()

  start(): void {
    try {
      this.bonjour = new Bonjour()
      const browser = this.bonjour.find({ type: 'ndi' })

      browser.on('up', (service: NdiService) => {
        const id = `${service.name}@${service.host}:${service.port}`
        this.sources.set(id, { id, name: service.name, host: service.host, port: service.port })
        this.emit('changed', this.list())
      })

      browser.on('down', (service: NdiService) => {
        const id = `${service.name}@${service.host}:${service.port}`
        this.sources.delete(id)
        this.emit('changed', this.list())
      })
    } catch (err) {
      console.error('[ndi-discovery] failed to start mDNS browser:', err)
    }
  }

  stop(): void {
    this.bonjour?.destroy()
    this.bonjour = null
    this.sources.clear()
  }

  list(): DiscoveredNdiSource[] {
    return Array.from(this.sources.values())
  }
}

export const ndiDiscovery = new NdiDiscoveryService()
