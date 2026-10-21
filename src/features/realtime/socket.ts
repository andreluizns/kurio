import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@/api/contracts'

export type KurioSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * Cria um socket para a sessão atual. Transporte apenas WebSocket: é o que o
 * interceptador do MSW simula (o long-polling HTTP do Engine.IO não é suportado pelo binding).
 * Este módulo é importado sob demanda, depois que os mocks instalam o interceptador de WebSocket
 * (o engine.io-client captura o construtor global de WebSocket ao ser avaliado).
 */
export function createSocket(token: string | null): KurioSocket {
  return io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: token ? { token } : {},
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
    timeout: 5000,
    autoConnect: false,
  })
}
