import { WebSocketServer, WebSocket } from 'ws'
import { ndiMatrix } from './ndiMatrix'
import type { ClientToServerMessage, ServerToClientMessage } from '../../shared/protocol'

/**
 * Registration + slide-sync channel for Client Nodes (ws://0.0.0.0:9800).
 * Separate from the JSON-RPC automation API on :9700 — that one is
 * request/response for Companion-style control, this one is a persistent
 * per-client connection so the server can push next/previous-slide
 * commands back down and receive live slide-state updates.
 */
const PORT = 9800

let wss: WebSocketServer | null = null
const socketsByClientId = new Map<string, WebSocket>()

function send(socket: WebSocket, message: ServerToClientMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

export function startClientHub(): void {
  wss = new WebSocketServer({ host: '0.0.0.0', port: PORT })

  wss.on('connection', (socket) => {
    let clientId: string | null = null

    socket.on('message', (raw) => {
      let message: ClientToServerMessage
      try {
        message = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (message.type === 'register') {
        clientId = ndiMatrix.registerClient(message)
        socketsByClientId.set(clientId, socket)
        send(socket, { type: 'registered', clientId })
        return
      }

      if (message.type === 'slide-state' && clientId) {
        ndiMatrix.syncSlideState(clientId, message)
      }
    })

    socket.on('close', () => {
      if (!clientId) return
      socketsByClientId.delete(clientId)
      ndiMatrix.setClientOnline(clientId, false)
    })
  })

  wss.on('error', (err) => console.error('[client-hub] server error:', err))

  ndiMatrix.setCommandForwarder((targetClientId, command) => {
    const socket = socketsByClientId.get(targetClientId)
    if (!socket) return false
    send(socket, { type: 'command', command })
    return true
  })

  console.log(`[client-hub] listening on ${PORT}`)
}

export function stopClientHub(): void {
  wss?.close()
  wss = null
  socketsByClientId.clear()
}
