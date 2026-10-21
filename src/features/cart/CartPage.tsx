import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import type { Cart, CartItem } from '@/api/contracts'
import { ArrowLeft2, Delete, Danger } from '@/components/icons'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageShell } from '@/components/layout/PageShell'
import { NftArtwork } from '@/components/nft/NftArtwork'
import { NftCarousel } from '@/components/nft/NftCarousel'
import { QuantityStepper } from '@/components/nft/QuantityStepper'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/session-store'
import { useRecommendations } from '@/features/catalog/queries'
import { formatEth } from '@/lib/money'
import { useIsDesktop } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { checkoutBlockReason } from './checkout-block'
import { CouponField, SummaryRows, SummarySkeleton } from './CartSummary'
import { useAcknowledgeCart, useCart, useRemoveCartItem, useUpdateCartItem } from './use-cart'

function useCheckoutAction() {
  const session = useSession()
  const navigate = useNavigate()
  return () => {
    if (session) void navigate({ to: '/pagamento' })
    else void navigate({ to: '/entrar', search: { redirect: '/pagamento' } })
  }
}

/** Aviso de alterações de preço/disponibilidade recebidas em tempo real ou na revalidação. */
export function CartChanges({ cart }: { cart: Cart }) {
  const acknowledge = useAcknowledgeCart()
  if (!cart.changes.length) return null
  const byId = new Map(cart.items.map((i) => [i.id, i]))
  const priceChanges = cart.changes.filter((c) => c.kind === 'price')
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-brand/60 bg-brand/10 p-4" data-testid="cart-changes">
      <p className="flex items-center gap-2 text-sm font-bold text-cream">
        <Danger className="size-[18px] text-brand-light" /> Alguns itens do seu carrinho mudaram
      </p>
      <ul className="flex flex-col gap-1 text-sm text-sand">
        {cart.changes.map((c) => {
          const item = byId.get(c.itemId)
          if (!item) return null
          return (
            <li key={`${c.itemId}-${c.kind}`}>
              {c.kind === 'price'
                ? `${item.name} (${item.editionLabel}): preço de ${formatEth(c.from)} para ${formatEth(c.to)}.`
                : Number(c.to) === 0
                  ? `${item.name} (${item.editionLabel}): edição esgotada. Remova o item para continuar.`
                  : `${item.name} (${item.editionLabel}): restam ${c.to} unidade(s). Ajuste a quantidade.`}
            </li>
          )
        })}
      </ul>
      {priceChanges.length > 0 && (
        <button
          type="button"
          onClick={() => acknowledge.mutate()}
          disabled={acknowledge.isPending}
          className="w-fit rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand-light hover:bg-brand/10"
        >
          Entendi os novos preços
        </button>
      )}
    </div>
  )
}

function itemProblem(item: CartItem) {
  if (item.available === 0) return 'Esgotado'
  if (item.quantity > item.available) return `Restam ${item.available}`
  return null
}

function DesktopRow({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const problem = itemProblem(item)
  return (
    <li className="grid min-h-[70px] grid-cols-[minmax(0,250px)_1fr_auto_1fr_auto] items-center gap-4 bg-surface pr-6 lg:grid-cols-[250px_139px_136px_148px_24px] lg:gap-0 xl:grid-cols-[311px_139px_136px_148px_24px]">
      <div className="flex items-center gap-4">
        <NftArtwork artwork={item.artwork} alt="" sizes="70px" className="size-[70px] shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="truncate text-base leading-4 font-bold text-cream hover:text-brand-light">
            {item.name}
          </Link>
          <span className="text-sm leading-4 text-khaki">
            ID do token: {item.tokenId} · {item.editionLabel}
          </span>
        </div>
      </div>
      <p className={cn('text-base leading-4 font-bold text-sand', item.unitPrice !== item.acknowledgedUnitPrice && 'text-brand-light')}>{formatEth(item.unitPrice)}</p>
      <div className="flex flex-col gap-1">
        <QuantityStepper
          size="md"
          value={item.quantity}
          max={Math.max(item.maxQuantity, 1)}
          onChange={(quantity) => update.mutate({ itemId: item.id, quantity: Math.max(1, Math.min(quantity, item.maxQuantity)) })}
          label={`Quantidade de ${item.name}`}
        />
        {problem && <span className="text-xs font-bold text-coral">{problem}</span>}
      </div>
      <p className="text-base leading-4 font-bold text-brand-light">{formatEth(item.lineTotal)}</p>
      <button
        type="button"
        onClick={() => remove.mutate(item.id)}
        disabled={remove.isPending}
        aria-label={`Remover ${item.name} do carrinho`}
        className="flex size-6 items-center justify-center text-khaki hover:text-coral"
      >
        <Delete className="size-6" />
      </button>
    </li>
  )
}

function MobileRow({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const problem = itemProblem(item)
  return (
    <li className="relative flex h-[100px] items-stretch overflow-hidden rounded-[14px] bg-surface shadow-lift">
      <button
        type="button"
        onClick={() => remove.mutate(item.id)}
        disabled={remove.isPending}
        aria-label={`Remover ${item.name} do carrinho`}
        className="absolute top-2 right-2 flex size-7 items-center justify-center text-khaki hover:text-coral"
      >
        <Delete className="size-[18px]" />
      </button>
      <NftArtwork artwork={item.artwork} alt="" sizes="100px" className="size-[100px] shrink-0 rounded-[14px]" />
      <div className="flex min-w-0 flex-1 flex-col justify-between py-3 pr-3 pl-2">
        <div className="flex flex-col gap-1.5">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="line-clamp-2 text-[15px] leading-4 font-bold text-cream">
            {item.name}
          </Link>
          <span className="text-sm leading-4 text-sand">Edição: {item.editionLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-lg leading-4 font-bold text-brand-light">{formatEth(item.lineTotal)}</p>
          {problem && <span className="text-xs font-bold text-coral">{problem}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end justify-center gap-1 pr-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => update.mutate({ itemId: item.id, quantity: Math.max(1, Math.min(item.quantity - 1, item.maxQuantity)) })}
            disabled={item.quantity <= 1}
            aria-label="Diminuir quantidade"
            className="flex size-6 items-center justify-center rounded-full border border-line bg-surface-2"
          >
            {/* Como no Figma: traço claro quando dá para diminuir, escuro na quantidade mínima. */}
            <span aria-hidden className={cn('block h-0.5 w-2.5', item.quantity > 1 ? 'bg-cream' : 'bg-line-2')} />
          </button>
          <output aria-label={`Quantidade: ${item.quantity}`} className="w-3 text-center text-base text-cream">
            {item.quantity}
          </output>
          <button
            type="button"
            onClick={() => update.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
            disabled={item.quantity >= item.maxQuantity}
            aria-label="Aumentar quantidade"
            className="flex size-6 items-center justify-center rounded-full border border-line bg-surface-2 text-xl leading-none text-cream disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
    </li>
  )
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-line px-6 py-16 text-center" role="status">
      <h2 className="text-lg font-bold text-cream">Seu carrinho está vazio</h2>
      <p className="max-w-sm text-sm leading-6 text-sand">Explore o mercado e adicione NFTs para continuar.</p>
      <Link to="/" hash="catalogo" className="mt-1 rounded-md bg-brand px-5 py-2 text-sm font-bold text-ink hover:bg-brand-light">
        Explorar NFTs
      </Link>
    </div>
  )
}


function DesktopCart() {
  const { data: cart, isPending, error, refetch, isFetching } = useCart()
  const checkout = useCheckoutAction()
  const recommendations = useRecommendations()

  return (
    <PageShell className="flex flex-col gap-24 pt-8">
      <div className="flex flex-col gap-3">
        <nav aria-label="Trilha de navegação">
          <ol className="flex gap-1 text-[15px] leading-4 font-bold text-cream">
            <li>
              <Link to="/">Início</Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link to="/" hash="catalogo">
                Mercado
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page">Carrinho</li>
          </ol>
        </nav>
        <h1 className="sr-only">Carrinho de NFTs</h1>
        {error && !cart ? (
          <ErrorState title="Não foi possível carregar o carrinho" error={error} onRetry={() => void refetch()} retrying={isFetching} />
        ) : (
          <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
            <section aria-label="Itens do carrinho" className="flex min-w-0 flex-1 flex-col gap-3 lg:max-w-[782px]">
              <div className="grid grid-cols-[minmax(0,250px)_1fr_auto_1fr_auto] border-b border-brand/30 pr-6 pb-3 text-base leading-4 text-cream lg:grid-cols-[250px_139px_136px_148px_24px] xl:grid-cols-[311px_139px_136px_148px_24px]" aria-hidden>
                <span className="font-bold">NFTs</span>
                <span className="font-medium">Preço</span>
                <span className="font-bold">Edições</span>
                <span className="font-medium">Total</span>
                <span />
              </div>
              {cart && <CartChanges cart={cart} />}
              {isPending ? (
                <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando itens">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-[70px] w-full rounded-none" />
                  ))}
                </ul>
              ) : cart && cart.items.length ? (
                <ul className="flex flex-col gap-3" data-testid="cart-items">
                  {cart.items.map((item) => (
                    <DesktopRow key={item.id} item={item} />
                  ))}
                </ul>
              ) : (
                <EmptyCart />
              )}
            </section>
            <aside aria-labelledby="summary-title" className="flex w-full flex-col gap-6 lg:w-[332px]">
              <div className="border-b border-brand/30 pb-3">
                <h2 id="summary-title" className="text-lg leading-4 font-bold text-cream">
                  Resumo da carteira
                </h2>
              </div>
              {isPending || !cart ? (
                <SummarySkeleton />
              ) : (
                <>
                  <CouponField cart={cart} />
                  <div className={cn('transition-opacity', isFetching && 'opacity-70')} aria-live="polite" aria-busy={isFetching}>
                    <SummaryRows summary={cart.summary} />
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={checkout}
                      disabled={!cart.items.length || !!checkoutBlockReason(cart)}
                      aria-describedby={checkoutBlockReason(cart) ? 'checkout-block-reason' : undefined}
                      className="h-10 w-full rounded-[3px] bg-brand text-[15px] leading-4 font-bold text-ink hover:bg-brand-light disabled:opacity-50"
                    >
                      Conectar e finalizar
                    </button>
                    {checkoutBlockReason(cart) && (
                      <p id="checkout-block-reason" className="text-center text-xs text-coral">
                        {checkoutBlockReason(cart)}
                      </p>
                    )}
                    <Link to="/" hash="catalogo" className="text-[15px] leading-5 text-brand-light hover:underline">
                      Continuar explorando
                    </Link>
                  </div>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
      <NftCarousel
        title="Colecionadores também viram"
        items={recommendations.data}
        isPending={recommendations.isPending}
        error={recommendations.error}
        onRetry={() => void recommendations.refetch()}
      />
    </PageShell>
  )
}

function MobileCart() {
  const { data: cart, isPending, error, refetch, isFetching } = useCart()
  const checkout = useCheckoutAction()
  const router = useRouter()

  return (
    <div className="flex min-h-dvh flex-col pt-8">
      <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col gap-3 px-7 pb-[360px] focus:outline-none">
        <div className="relative flex h-11 items-center justify-center">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: '/' }))}
            aria-label="Voltar"
            className="absolute left-0 flex size-[35px] items-center justify-center rounded-full border border-line bg-surface-2 text-khaki"
          >
            <ArrowLeft2 className="size-5" />
          </button>
          <h1 className="text-xl leading-4 font-bold text-cream">Carrinho de NFTs</h1>
        </div>
        {cart && <CartChanges cart={cart} />}
        {error && !cart ? (
          <ErrorState title="Não foi possível carregar o carrinho" error={error} onRetry={() => void refetch()} retrying={isFetching} />
        ) : isPending ? (
          <ul className="flex flex-col gap-5" aria-busy="true" aria-label="Carregando itens">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[100px] w-full rounded-[14px]" />
            ))}
          </ul>
        ) : cart && cart.items.length ? (
          <ul className="flex flex-col gap-5" data-testid="cart-items">
            {cart.items.map((item) => (
              <MobileRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <EmptyCart />
        )}
      </main>
      {cart && cart.items.length > 0 && (
        <aside aria-label="Resumo do pagamento" className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 rounded-t-[40px] bg-surface px-6 pt-6 pb-9">
          <CouponField cart={cart} variant="mobile" />
          <div aria-live="polite" className={cn('transition-opacity', isFetching && 'opacity-70')}>
            <SummaryRows summary={cart.summary} variant="mobile" />
          </div>
          {checkoutBlockReason(cart) && (
            <p id="checkout-block-reason-mobile" className="text-center text-xs text-coral">
              {checkoutBlockReason(cart)}
            </p>
          )}
          <button
            type="button"
            onClick={checkout}
            disabled={!!checkoutBlockReason(cart)}
            aria-describedby={checkoutBlockReason(cart) ? 'checkout-block-reason-mobile' : undefined}
            className="mt-4 h-[60px] rounded-[40px] bg-[linear-gradient(90deg,#d28a4c,#b8763f)] text-base font-bold text-ink disabled:opacity-50"
          >
            Conectar e finalizar
          </button>
        </aside>
      )}
    </div>
  )
}

export function CartPage() {
  return useIsDesktop() ? <DesktopCart /> : <MobileCart />
}
