import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { Cart, CreateOrderRequest, Network, Quote, WalletConnection, WalletProvider } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { isApiError, type ApiError } from '@/api/http'
import { queryKeys } from '@/api/query-keys'
import { NftArtwork } from '@/components/nft/NftArtwork'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/session-store'
import { useCart } from '@/features/cart/use-cart'
import { NETWORK_LABELS } from '@/features/catalog/search-params'
import { formatDiscount, formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { attemptStore, draftStore } from './attempt-store'
import { PROVIDER_LABELS, type CheckoutValues } from './schema'

type Step = 'quoting' | 'review' | 'submitting' | 'verifying'

interface QuoteChange {
  previousTotal: string
}

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

/** A cotação fica desatualizada quando o carrinho (atualizado por eventos) diverge dela. */
function isStale(quote: Quote, cart: Cart | undefined) {
  if (!cart) return false
  if (cart.items.length !== quote.lines.length) return true
  return quote.lines.some((line) => {
    const item = cart.items.find((i) => i.id === line.itemId)
    return !item || item.unitPrice !== line.unitPrice || item.quantity !== line.quantity || item.available < line.quantity
  })
}

/**
 * Revisão do pedido. É montado a cada abertura (key no pai), então o estado
 * inicial vale para uma nova revisão: nova cotação ou retomada da tentativa salva.
 */
export function ReviewDialog({
  onOpenChange,
  values,
  resume = false,
}: {
  onOpenChange: (open: boolean) => void
  values: CheckoutValues
  /** Reabre uma tentativa interrompida (timeout/refresh) com a mesma chave. */
  resume?: boolean
}) {
  const open = true
  const session = useSession()
  const userId = session?.user.id ?? ''
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: cart } = useCart()
  const [step, setStep] = useState<Step>(() => (resume && attemptStore.get(userId) ? 'verifying' : 'quoting'))
  const [quote, setQuote] = useState<Quote | null>(null)
  const [change, setChange] = useState<QuoteChange | null>(null)
  const [connection, setConnection] = useState<WalletConnection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const network: Network = values.network
  const provider: WalletProvider = values.provider
  const address = values.address

  const quoteMutation = useMutation({
    mutationFn: () => api.checkout.quote({ network }),
    onSuccess: (q) => {
      setQuote(q)
      setStep('review')
    },
    onError: (e: ApiError) => {
      setError(e.message)
      setStep('review')
      if (e.code === 'AVAILABILITY_CONFLICT' || e.code.startsWith('COUPON')) void qc.invalidateQueries({ queryKey: queryKeys.cart(userId) })
    },
  })

  const connectMutation = useMutation({
    mutationFn: () => api.wallets.connect({ provider, network, address }),
    onSuccess: (c) => {
      setConnection(c)
      setError(null)
    },
    onError: (e: ApiError) => setError(e.code === 'WALLET_REJECTED' ? 'Você recusou a conexão na carteira. Tente novamente para continuar.' : e.message),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.wallets.disconnect(id),
    onSettled: () => setConnection(null),
  })

  // Ao montar: retoma a tentativa salva (mesma chave) ou solicita nova cotação.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const attempt = resume ? attemptStore.get(userId) : null
    if (attempt) void submitWith(attempt.body, attempt.key)
    else quoteMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stale = quote ? isStale(quote, cart) : false

  async function submitWith(body: CreateOrderRequest, key: string) {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      let order
      try {
        order = await api.checkout.createOrder(body, key)
      } catch (first) {
        // Timeout/queda de rede: reenvia com a MESMA chave para recuperar o pedido já criado.
        if (isApiError(first) && (first.code === 'TIMEOUT' || first.code === 'NETWORK_ERROR')) {
          setStep('verifying')
          order = await api.checkout.createOrder(body, key)
        } else {
          throw first
        }
      }
      attemptStore.clear()
      draftStore.clear()
      qc.setQueryData(queryKeys.order(userId, order.id), order)
      void qc.invalidateQueries({ queryKey: queryKeys.cart(userId) })
      onOpenChange(false)
      void navigate({ to: '/pedido/$orderId', params: { orderId: order.id } })
    } catch (e) {
      const err = e as ApiError
      setStep('review')
      if (err.code === 'QUOTE_CHANGED') {
        const details = err.details as { quote: Quote; previousTotal: string }
        attemptStore.clear()
        setQuote(details.quote)
        setChange({ previousTotal: details.previousTotal })
        void qc.invalidateQueries({ queryKey: queryKeys.cart(userId) })
      } else if (err.code === 'AVAILABILITY_CONFLICT' || err.code === 'QUOTE_EXPIRED') {
        attemptStore.clear()
        setQuote(null)
        setError(err.code === 'QUOTE_EXPIRED' ? 'A cotação expirou. Gere uma nova cotação para continuar.' : `${err.message} Revise o carrinho.`)
        void qc.invalidateQueries({ queryKey: queryKeys.cart(userId) })
      } else if (err.code === 'WALLET_NOT_CONNECTED') {
        attemptStore.clear()
        setConnection(null)
        setError(err.message)
      } else if (err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR') {
        setStep('verifying')
        setError('Não conseguimos confirmar o envio do pedido. Verifique novamente — nenhuma compra duplicada será criada.')
      } else {
        setError(err.message)
      }
    } finally {
      inFlight.current = false
    }
  }

  const pay = () => {
    if (!quote || !connection || stale) return
    const body: CreateOrderRequest = {
      quoteId: quote.id,
      walletConnectionId: connection.id,
      walletSlot: values.useOtherWallet ? 'other' : values.walletSlot || 'other',
      walletAddress: values.address,
      provider,
      network,
      buyer: {
        displayName: values.displayName,
        username: values.username,
        profileName: values.profileName,
        email: values.email,
        referralCode: values.referralCode,
        ensName: values.ensName,
        ensSuffix: values.ensSuffix,
        note: values.note,
      },
    }
    const attempt = attemptStore.begin(userId, body)
    setStep('submitting')
    void submitWith(body, attempt.key)
  }

  const retryVerification = () => {
    const attempt = attemptStore.get(userId)
    if (attempt) void submitWith(attempt.body, attempt.key)
  }

  const busy = step === 'submitting' || step === 'verifying'

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="w-[578px] max-w-[calc(100%-2rem)] gap-5 border-b-[10px] border-brand p-0 sm:max-w-[578px]">
        <div className="flex flex-col gap-2 px-6 pt-8 sm:px-11">
          <DialogTitle>Revise seu pedido</DialogTitle>
          <DialogDescription>
            Confira itens, valores e carteira antes de confirmar. A cotação é a referência final do pagamento.
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-4 px-6 sm:px-11" aria-live="polite" aria-busy={step === 'quoting'}>
          {step === 'quoting' || (!quote && !error) ? (
            <div className="flex flex-col gap-3" aria-label="Gerando cotação">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : quote ? (
            <>
              {change && (
                <div role="alert" className="rounded-md border border-brand bg-brand/10 p-3 text-sm text-cream" data-testid="quote-changed">
                  <strong className="text-brand-light">Os valores mudaram.</strong> O total foi de {formatEth(change.previousTotal)} para{' '}
                  {formatEth(quote.total)}. Revise e confirme novamente.
                </div>
              )}
              {stale && !change && (
                <div role="alert" className="flex flex-col gap-2 rounded-md border border-coral/60 bg-coral/10 p-3 text-sm text-cream" data-testid="quote-stale">
                  <span>Preço ou disponibilidade mudou enquanto você revisava. Atualize a cotação para continuar.</span>
                  <button type="button" onClick={() => quoteMutation.mutate()} className="w-fit rounded bg-brand px-3 py-1.5 text-xs font-bold text-ink">
                    Atualizar cotação
                  </button>
                </div>
              )}
              <ul className="flex max-h-[220px] flex-col gap-3 overflow-y-auto pr-1">
                {quote.lines.map((line) => (
                  <li key={line.itemId} className="flex items-center gap-3">
                    <NftArtwork artwork={line.artwork} alt="" sizes="48px" className="size-12 rounded-md" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-bold text-cream">{line.name}</span>
                      <span className="text-xs text-khaki">
                        {line.editionLabel} · {formatEth(line.unitPrice)} × {line.quantity}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-brand-light">{formatEth(line.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <dl className="flex flex-col gap-2 border-t border-line pt-3 text-sm text-cream">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatEth(quote.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Desconto{quote.coupon ? ` (${quote.coupon.code})` : ''}</dt>
                  <dd>{formatDiscount(quote.discount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Taxa de rede ({NETWORK_LABELS[quote.network]})</dt>
                  <dd>{formatEth(quote.networkFee)}</dd>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <dt>Total</dt>
                  <dd className="text-brand-light" data-testid="review-total">
                    {formatEth(quote.total)}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-col gap-2 rounded-md border border-line p-3">
                <p className="text-sm text-cream">
                  {PROVIDER_LABELS[provider]} · {NETWORK_LABELS[network]} · <span className="text-sand">{shortAddress(address)}</span>
                </p>
                {connection ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm text-mint" role="status">
                      <span aria-hidden className="size-2 rounded-full bg-mint" /> Carteira conectada
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => disconnectMutation.mutate(connection.id)}
                      className="text-xs text-brand-light underline-offset-4 hover:underline disabled:opacity-50"
                    >
                      Desconectar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="h-10 rounded-md border border-brand text-sm font-bold text-brand-light hover:bg-brand/10 disabled:opacity-60"
                  >
                    {connectMutation.isPending ? `Aguardando aprovação na ${PROVIDER_LABELS[provider]}…` : `Conectar ${PROVIDER_LABELS[provider]}`}
                  </button>
                )}
              </div>
            </>
          ) : null}

          {error && (
            <p role="alert" className="rounded-md border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral" data-testid="checkout-error">
              {error}
            </p>
          )}
          {step === 'verifying' && (
            <p role="status" className="text-sm text-sand">
              Verificando o status do pedido com a mesma chave de idempotência…
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 px-6 pb-8 sm:flex-row sm:px-11">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="h-11 flex-1 rounded-md border border-line text-sm text-sand hover:border-brand disabled:opacity-50"
          >
            Voltar e editar
          </button>
          {step === 'verifying' && error ? (
            <button type="button" onClick={retryVerification} className="h-11 flex-1 rounded-md bg-brand text-sm font-bold text-ink">
              Verificar novamente
            </button>
          ) : !quote ? (
            <button type="button" onClick={() => quoteMutation.mutate()} disabled={quoteMutation.isPending} className="h-11 flex-1 rounded-md bg-brand text-sm font-bold text-ink disabled:opacity-60">
              Gerar nova cotação
            </button>
          ) : (
            <button
              type="button"
              onClick={pay}
              disabled={!connection || busy || stale}
              aria-disabled={!connection || busy || stale}
              className={cn('h-11 flex-1 rounded-md bg-brand text-sm font-bold text-ink hover:bg-brand-light disabled:opacity-50')}
              data-testid="confirm-payment"
            >
              {busy ? 'Enviando pedido…' : change ? `Confirmar novo total (${formatEth(quote.total)})` : `Pagar ${formatEth(quote.total)}`}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
