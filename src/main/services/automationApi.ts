import { createServer, type Server } from 'http'
import { ndiMatrix } from './ndiMatrix'
import type { AutomationCommand } from '../../shared/types'

/**
 * JSON-RPC control surface for Bitfocus Companion / Stream Deck. Listens
 * on a local-only port so a Companion module can POST commands without
 * going through the renderer. OSC transport (dgram + node-osc) can sit
 * alongside this on its own port later — kept out for now since nothing
 * in the current UI exercises it yet.
 */
const PORT = 9700

function execute(command: AutomationCommand): void {
  switch (command.type) {
    case 'route':
      ndiMatrix.route(command.outputId, command.sourceId)
      return
    case 'recall-preset':
    case 'send-note':
    case 'next-slide':
    case 'previous-slide':
      throw new Error(`Command not yet implemented: ${command.type}`)
  }
}

let server: Server | null = null

export function startAutomationApi(): void {
  server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/rpc') {
      res.writeHead(404).end()
      return
    }
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        const command = JSON.parse(body) as AutomationCommand
        execute(command)
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }))
      } catch (error) {
        res
          .writeHead(400, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ ok: false, error: (error as Error).message }))
      }
    })
  })
  server.on('error', (err) => console.error('[automation-api] listen error:', err))
  server.listen(PORT, '127.0.0.1', () => console.log(`[automation-api] listening on ${PORT}`))
}

export function stopAutomationApi(): void {
  server?.close()
  server = null
}
