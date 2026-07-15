import { createServer, type Server } from 'http'
import { ndiMatrix } from './ndiMatrix'
import type { AutomationCommand } from '../../shared/types'

/**
 * JSON-RPC control surface for Bitfocus Companion / Stream Deck. Listens
 * on a local-only port so a Companion module can POST commands without
 * going through the renderer. Shares executeCommand with the in-app
 * Control Surface panel so both paths stay behaviorally identical. OSC
 * transport (dgram + node-osc) can sit alongside this on its own port
 * later — kept out for now since nothing exercises it yet.
 *
 * Deliberately loopback-only (127.0.0.1), unlike the client hub (:9800)
 * — this endpoint executes commands with zero authentication, so widening
 * it to the network is a real security tradeoff the operator should make
 * explicitly (e.g. via an SSH tunnel or a reverse proxy with auth) rather
 * than something this project defaults to. If Companion runs on a
 * separate Stream Deck machine, see the companion module's README for
 * how to reach this port from there.
 */
const PORT = 9700

let server: Server | null = null

export function startAutomationApi(): void {
  server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/state') {
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify(ndiMatrix.getState()))
      return
    }

    if (req.method !== 'POST' || req.url !== '/rpc') {
      res.writeHead(404).end()
      return
    }
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        const command = JSON.parse(body) as AutomationCommand
        ndiMatrix.executeCommand(command)
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
