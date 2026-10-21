import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { GUEST, queryKeys } from '@/api/query-keys'
import { mocksReady } from '@/app/mocks-ready'
import { useSession } from '@/features/auth/session-store'
import { formatEth } from '@/lib/money'
import { applyNftUpdated, applyOrderUpdated } from './apply-events'
import type { KurioSocket } from './socket'
import { setRealtimeStatus } from './status'

/** O cliente Socket.IO só é carregado depois que os mocks instalam o interceptador de WebSocket. */
const loadSocketModule = () => mocksReady.then(() => import('./socket'))

function attachHandlers(socket: KurioSocket, queryClient: QueryClient, userId: string | null) {
  const owner = userId ?? GUEST
  let connectedOnce = false

  socket.on('connect', () => {
    setRealtimeStatus('connected')
    if (connectedOnce) {
      // Reconciliação após reconexão: eventos perdidos são recuperados pela API REST.
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart(owner) })
      if (userId) void queryClient.invalidateQueries({ queryKey: ['user', userId, 'order'] })
      if (userId) void queryClient.invalidateQueries({ queryKey: ['user', userId, 'orders'] })
    }
    connectedOnce = true
  })
  socket.on('disconnect', (reason) => {
    setRealtimeStatus(reason === 'io client disconnect' ? 'idle' : 'reconnecting')
  })
  socket.io.on('reconnect_attempt', () => setRealtimeStatus('reconnecting'))

  socket.on('nft.updated', (event) => {
    const outcome = applyNftUpdated(queryClient, event, owner)
    if (!outcome.applied) return
    for (const item of outcome.inCart) {
      const edition = event.data.editions.find((e) => e.id === item.editionId)
      if (!edition) continue
      if (edition.price !== item.unitPrice) {
        toast.warning(`Preço atualizado: ${item.name}`, {
          id: `price-${item.id}`,
          description: `${item.editionLabel}: de ${formatEth(item.unitPrice)} para ${formatEth(edition.price)}. O resumo foi recalculado.`,
        })
      } else if (edition.available < item.quantity) {
        toast.warning(`Disponibilidade alterada: ${item.name}`, {
          id: `stock-${item.id}`,
          description:
            edition.available === 0
              ? `A edição ${item.editionLabel} esgotou.`
              : `Restam ${edition.available} unidade(s) da edição ${item.editionLabel}.`,
        })
      }
    }
  })

  socket.on('order.updated', (event) => {
    if (!applyOrderUpdated(queryClient, event, userId)) return
    if (event.data.status === 'confirmed') toast.success('Pagamento confirmado na rede.', { id: `order-${event.resource.id}` })
    if (event.data.status === 'declined') toast.error('Pagamento recusado. Seus itens continuam no carrinho.', { id: `order-${event.resource.id}` })
  })
}

/**
 * Mantém um socket por sessão. Ao trocar de usuário (ou sair), o socket anterior é
 * encerrado e todos os listeners são liberados; eventos da sessão anterior não chegam mais.
 */
export function RealtimeProvider() {
  const session = useSession()
  const queryClient = useQueryClient()
  const token = session?.token ?? null
  const userId = session?.user.id ?? null

  useEffect(() => {
    let socket: KurioSocket | null = null
    let disposed = false

    void loadSocketModule().then(({ createSocket }) => {
      if (disposed) return
      socket = createSocket(token)
      attachHandlers(socket, queryClient, userId)
      setRealtimeStatus('connecting')
      socket.connect()
    })

    return () => {
      disposed = true
      if (socket) {
        socket.removeAllListeners()
        socket.io.removeAllListeners()
        socket.disconnect()
      }
      setRealtimeStatus('idle')
    }
  }, [token, userId, queryClient])

  return null
}
