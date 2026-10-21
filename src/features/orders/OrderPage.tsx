import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { Order } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { queryKeys } from '@/api/query-keys'
import { ThankYou } from '@/components/icons'
import { ErrorState } from '@/components/feedback/ErrorState'
import { NotFound } from '@/components/feedback/NotFound'
import { NftArtwork } from '@/components/nft/NftArtwork'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/session-store'
import { observeVersion } from '@/features/realtime/apply-events'
import { useRealtimeStatus } from '@/features/realtime/status'
import { NETWORK_LABELS } from '@/features/catalog/search-params'
import { PROVIDER_LABELS } from '@/features/checkout/schema'
import { formatEth } from '@/lib/money'

function shortHash(hash: string) {
  return `${hash.slice(0, 6).toUpperCase().replace('0X', '0x')}…${hash.slice(-4).toUpperCase()}`
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return `${d.getDate()} ${month.charAt(0).toUpperCase()}${month.slice(1)}, ${d.getFullYear()}`
}

/** Polling de segurança enquanto pendente: cobre eventos perdidos sem depender só do socket. */
function useOrder(orderId: string) {
  const userId = useSession()?.user.id ?? 'anonymous'
  const realtime = useRealtimeStatus()
  return useQuery({
    queryKey: queryKeys.order(userId, orderId),
    queryFn: async ({ signal }) => {
      const order = await api.orders.get(orderId, { signal })
      observeVersion(`order:${order.id}`, order.version)
      return order
    },
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? (realtime === 'connected' ? 8000 : 3000) : false),
  })
}

function Receipt({ order }: { order: Order }) {
  const meta = [
    { label: 'ID da transação', value: order.transactionHash ? shortHash(order.transactionHash) : '—', strong: true },
    { label: 'Data', value: formatDate(order.updatedAt) },
    { label: 'Total', value: formatEth(order.total) },
    { label: 'Carteira', value: PROVIDER_LABELS[order.provider], strong: true },
  ]
  return (
    <>
      <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center">
        <ThankYou className="h-20 w-20 text-brand" />
        <DialogTitle className="text-base leading-5 font-bold text-sand">Seus NFTs agora estão na sua carteira</DialogTitle>
      </div>
      <dl className="grid grid-cols-2 gap-y-3 border-y border-brand px-4 py-4 sm:flex sm:justify-center sm:px-6">
        {meta.map((m, i) => (
          <div key={m.label} className={`flex flex-col gap-0.5 px-2 sm:px-4 ${i > 0 ? 'sm:border-l sm:border-brand' : ''}`}>
            <dt className={`text-sm leading-4 whitespace-nowrap ${m.strong ? 'font-bold text-sand' : 'text-sand'}`}>{m.label}</dt>
            <dd className="text-sm leading-5 whitespace-nowrap text-sand" data-testid={i === 0 ? 'receipt-tx' : undefined}>
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3 px-6 pt-6 sm:px-11">
        <h2 className="text-[15px] leading-4 font-bold text-cream">Detalhes da transação</h2>
        <table className="w-full text-left">
          <caption className="sr-only">Itens comprados</caption>
          <thead>
            <tr className="border-b border-line text-base leading-4 text-cream">
              <th scope="col" className="pb-3 font-bold">
                NFTs
              </th>
              <th scope="col" className="pb-3 text-center font-medium">
                Edições
              </th>
              <th scope="col" className="pb-3 text-right font-medium">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.itemId}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <NftArtwork artwork={line.artwork} alt="" sizes="70px" className="size-12 shrink-0 rounded-md sm:size-[70px]" />
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm leading-4 font-bold text-cream sm:text-base">{line.name}</span>
                      <span className="hidden text-sm leading-4 text-khaki sm:block">ID do token: {line.tokenId}</span>
                    </div>
                  </div>
                </td>
                <td className="px-1 text-center text-sm whitespace-nowrap text-sand">(x {line.quantity})</td>
                <td className="text-right text-base leading-4 font-bold whitespace-nowrap text-brand-light sm:text-lg">{formatEth(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto flex w-full max-w-[322px] flex-col gap-2 pt-2 text-cream">
          {order.discount !== '0' && (
            <div className="flex justify-between text-[15px]">
              <dt>Desconto ({order.coupon?.code})</dt>
              <dd>(-) {formatEth(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-[15px]">
            <dt>Taxa de rede</dt>
            <dd className="text-lg leading-4">{formatEth(order.networkFee)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-base font-bold">Total</dt>
            <dd className="text-lg leading-4 font-bold text-brand-light" data-testid="receipt-total">
              {formatEth(order.total)}
            </dd>
          </div>
        </dl>
        <p className="border-t border-line pt-3 text-center text-sm leading-[22px] text-sand">
          Transação confirmada na {NETWORK_LABELS[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
        </p>
      </div>
      <div className="flex justify-center px-6 pt-5 pb-12">
        {order.explorerUrl && (
          <a
            href={order.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center rounded-[3px] bg-brand px-4 text-base font-bold text-ink hover:bg-brand-light"
          >
            Ver no Etherscan<span className="sr-only"> (simulado, abre em nova aba)</span>
          </a>
        )}
      </div>
    </>
  )
}

function Pending({ order }: { order: Order }) {
  const realtime = useRealtimeStatus()
  return (
    <div className="flex flex-col items-center gap-4 px-8 py-14 text-center" data-testid="order-pending">
      <span aria-hidden className="size-12 animate-spin rounded-full border-4 border-brand/30 border-t-brand motion-reduce:animate-none" />
      <DialogTitle className="text-lg font-bold text-cream">Aguardando confirmação na rede</DialogTitle>
      <DialogDescription className="max-w-sm text-sm leading-6 text-sand">
        Seu pedido de {formatEth(order.total)} foi enviado e está pendente. Você pode recarregar a página: o status será recuperado sem criar outra compra.
      </DialogDescription>
      <p role="status" className="text-xs text-khaki">
        {realtime === 'connected' ? 'Conectado em tempo real.' : 'Reconectando ao tempo real… verificando o status periodicamente.'}
      </p>
    </div>
  )
}

function Declined({ order }: { order: Order }) {
  return (
    <div className="flex flex-col items-center gap-4 px-8 py-14 text-center" data-testid="order-declined">
      <DialogTitle className="text-xl font-bold text-coral">Pagamento recusado</DialogTitle>
      <DialogDescription className="max-w-sm text-sm leading-6 text-sand">
        {order.declineReason ?? 'A transação não foi concluída.'} Seus itens continuam no carrinho.
      </DialogDescription>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/carrinho" className="rounded-md border border-brand px-5 py-2.5 text-sm font-bold text-brand-light">
          Ver carrinho
        </Link>
        <Link to="/pagamento" className="rounded-md bg-brand px-5 py-2.5 text-sm font-bold text-ink">
          Tentar novamente
        </Link>
      </div>
    </div>
  )
}

export function OrderPage({ orderId }: { orderId: string }) {
  const navigate = useNavigate()
  const { data: order, isPending, error, refetch, isFetching } = useOrder(orderId)
  const status = order?.status

  useEffect(() => {
    if (status) document.title = status === 'confirmed' ? 'Pedido confirmado — Kurio' : status === 'declined' ? 'Pagamento recusado — Kurio' : 'Pedido pendente — Kurio'
  }, [status])

  if (!order && isApiError(error) && error.status === 404) {
    return <NotFound title="Pedido não encontrado" description="Este pedido não existe ou não pertence à sua conta." />
  }

  return (
    <main id="conteudo" className="min-h-dvh bg-ink">
      <Dialog open onOpenChange={(open) => !open && void navigate({ to: '/' })}>
        <DialogContent className="w-[578px] max-w-[calc(100%-1rem)] gap-0 border-b-[10px] border-brand p-0 sm:max-w-[578px]">
          {order?.status === 'confirmed' ? (
            <>
              <DialogDescription className="sr-only">Recibo do pedido {order.id}</DialogDescription>
              <Receipt order={order} />
            </>
          ) : order?.status === 'declined' ? (
            <Declined order={order} />
          ) : order ? (
            <Pending order={order} />
          ) : error ? (
            <div className="p-6">
              <DialogTitle className="sr-only">Erro ao carregar pedido</DialogTitle>
              <ErrorState title="Não foi possível carregar o pedido" error={error} onRetry={() => void refetch()} retrying={isFetching} />
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-8" aria-busy={isPending}>
              <DialogTitle className="sr-only">Carregando pedido</DialogTitle>
              <Skeleton className="mx-auto size-20 rounded-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
