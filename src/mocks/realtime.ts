import { ws, type WebSocketHandlerConnection } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type {
  NftDetail,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
} from '@/api/contracts'
import { db, nextId, persist, type StoredEvent } from './db'
import { isActive } from './scenarios'

/**
 * Servidor Socket.IO simulado sobre o interceptador de WebSocket do MSW.
 * O cliente real (`socket.io-client`, transporte websocket) conecta normalmente;
 * este módulo decodifica/codifica o protocolo Engine.IO/Socket.IO via `toSocketIo`.
 */

interface ClientEntry {
  connection: WebSocketHandlerConnection
  io: ReturnType<typeof toSocketIo>
  userId: string | null
  heartbeat: ReturnType<typeof setInterval>
}

const clients = new Set<ClientEntry>()

function socketUrl() {
  const origin = typeof location !== 'undefined' ? location.origin : 'http://localhost'
  // O MSW remove o prefixo /socket.io/ do caminho antes de comparar (suporte nativo a Socket.IO).
  return `${origin.replace(/^http/, 'ws')}/`
}

const MAX_STORED_EVENTS = 50

function store(event: StoredEvent) {
  const d = db()
  d.events.push(event)
  if (d.events.length > MAX_STORED_EVENTS) d.events.splice(0, d.events.length - MAX_STORED_EVENTS)
  persist()
}

function userFromAuth(raw: string): string | null {
  // Pacote CONNECT do Socket.IO: "40" + JSON opcional com o `auth` do cliente.
  try {
    const payload = JSON.parse(raw.slice(2) || '{}') as { token?: string }
    const session = payload.token ? db().sessions[payload.token] : undefined
    return session && session.expiresAt > Date.now() ? session.userId : null
  } catch {
    return null
  }
}

export function realtimeHandler() {
  const link = ws.link(socketUrl())
  return link.addEventListener('connection', (connection) => {
    // Outras conexões na mesma origem (ex.: HMR do Vite) seguem para o servidor real.
    if (!connection.client.url.pathname.startsWith('/socket.io/')) {
      connection.server.connect()
      return
    }
    if (isActive('socket-offline')) {
      connection.client.close(4011, 'Servidor de tempo real indisponível')
      return
    }

    const io = toSocketIo(connection)
    const entry: ClientEntry = {
      connection,
      io,
      userId: null,
      // O binding não envia PING; sem ele o cliente encerra a conexão após pingInterval + pingTimeout.
      heartbeat: setInterval(() => connection.client.send('2'), 20_000),
    }
    clients.add(entry)

    connection.client.addEventListener('message', (event) => {
      if (typeof event.data === 'string' && event.data.startsWith('40')) {
        entry.userId = userFromAuth(event.data)
        io.client.emit('session.ready', { userId: entry.userId })
      }
    })

    connection.client.addEventListener('close', () => {
      clearInterval(entry.heartbeat)
      clients.delete(entry)
    })
  })
}

function nftEvent(nft: NftDetail): NftUpdatedEvent {
  return {
    id: nextId('evt'),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      price: nft.price,
      previousPrice: nft.previousPrice,
      available: nft.available,
      editions: nft.editions.map(({ id, price, available }) => ({ id, price, available })),
    },
  }
}

function orderEvent(order: Order): OrderUpdatedEvent {
  return {
    id: nextId('evt'),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    data: {
      userId: order.userId,
      status: order.status,
      transactionHash: order.transactionHash,
      explorerUrl: order.explorerUrl,
      declineReason: order.declineReason,
    },
  }
}

function safeEmit(client: ClientEntry, name: StoredEvent['type'], event: StoredEvent) {
  try {
    client.io.client.emit(name, event)
  } catch {
    // Conexão já encerrada pelo cliente.
    clearInterval(client.heartbeat)
    clients.delete(client)
  }
}

export function dispatch(event: StoredEvent) {
  for (const client of clients) {
    if (event.type === 'order.updated') {
      // Eventos de pedido só chegam aos sockets autenticados como o dono do pedido.
      if (client.userId !== event.data.userId) continue
      safeEmit(client, 'order.updated', event)
    } else {
      safeEmit(client, 'nft.updated', event)
    }
  }
}

export function publishNftUpdated(nft: NftDetail) {
  const event = nftEvent(nft)
  store(event)
  dispatch(event)
  return event
}

export function publishOrderUpdated(order: Order) {
  const event = orderEvent(order)
  store(event)
  dispatch(event)
  return event
}

/** Reenvia o último evento (duplicata) ou um evento com versão antiga para o mesmo recurso. */
export function replayEvent(mode: 'duplicate' | 'stale', type?: StoredEvent['type']) {
  const events = db().events.filter((e) => !type || e.type === type)
  const last = events.at(-1)
  if (!last) return null
  if (mode === 'duplicate') {
    dispatch(last)
    return last
  }
  const older = events.filter((e) => e.resource.id === last.resource.id && e.version < last.version).at(-1)
  const stale: StoredEvent = older
    ? { ...older, id: nextId('evt') }
    : ({ ...last, id: nextId('evt'), version: last.version - 1 } as StoredEvent)
  dispatch(stale)
  return stale
}

/** Derruba todas as conexões ativas (o cliente tenta reconectar automaticamente). */
export function disconnectAll() {
  for (const client of [...clients]) {
    clearInterval(client.heartbeat)
    client.connection.client.close(4001, 'Conexão encerrada pelo servidor simulado')
    clients.delete(client)
  }
}

export function connectedClients() {
  return [...clients].map((c) => ({ userId: c.userId }))
}
