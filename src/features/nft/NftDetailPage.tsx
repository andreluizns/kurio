import { useId, useState } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { NftDetail, NftEdition } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { ArrowLeft2, Heart, Linkedin, Message, Star, TabShop, Twitter, Zoom } from '@/components/icons'
import { ErrorState } from '@/components/feedback/ErrorState'
import { NotFound } from '@/components/feedback/NotFound'
import { PageShell } from '@/components/layout/PageShell'
import { EditionPicker } from '@/components/nft/EditionPicker'
import { NftArtwork } from '@/components/nft/NftArtwork'
import { artworkSrc } from '@/lib/artwork'
import { NftCarousel } from '@/components/nft/NftCarousel'
import { QuantityStepper } from '@/components/nft/QuantityStepper'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart } from '@/features/cart/use-cart'
import { useNftDetail, useRelated } from '@/features/catalog/queries'
import { NETWORK_LABELS } from '@/features/catalog/search-params'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/use-favorites'
import { formatEth } from '@/lib/money'
import { useIsDesktop } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

/** Vistas da galeria: a mesma arte em enquadramentos diferentes (o arquivo fornece uma arte por NFT). */
const VIEWS = [
  { label: 'Obra completa', style: {} },
  { label: 'Detalhe do rosto', style: { transform: 'scale(1.45)', transformOrigin: '50% 30%' } },
  { label: 'Detalhe do figurino', style: { transform: 'scale(1.6)', transformOrigin: '50% 85%' } },
  { label: 'Detalhe dos acessórios', style: { transform: 'scale(1.3)', transformOrigin: '35% 45%' } },
]

function useEditionState(nft: NftDetail | undefined, editionParam?: string) {
  const [selected, setSelected] = useState<string | undefined>(editionParam)
  const [quantity, setQuantity] = useState(1)
  const firstAvailable = nft?.editions.find((e) => e.available > 0)
  const preferred = nft?.editions.find((e) => e.id === (selected ?? nft.defaultEditionId) && e.available > 0)
  const edition: NftEdition | undefined = preferred ?? firstAvailable ?? nft?.editions[0]
  const max = edition ? Math.max(1, Math.min(edition.available, nft!.maxPerOrder)) : 1
  return {
    edition,
    max,
    quantity: Math.min(quantity, max),
    setQuantity,
    select: (id: string) => {
      setSelected(id)
      setQuantity(1)
    },
    soldOut: !firstAvailable,
  }
}

function useBuy(nft: NftDetail | undefined) {
  const add = useAddToCart()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const buy = (edition: NftEdition | undefined, quantity: number, goToCart: boolean) => {
    if (!nft || !edition) return
    setError(null)
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          toast.success(`${nft.name} (${edition.label}) adicionado ao carrinho.`, { id: `cart-${nft.id}` })
          if (goToCart) void navigate({ to: '/carrinho' })
        },
        onError: (e) => setError(isApiError(e) ? e.message : 'Não foi possível adicionar ao carrinho.'),
      },
    )
  }
  return { buy, error, pending: add.isPending }
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-[15px]', i < Math.round(rating) ? 'text-brand' : 'text-line-2')} />
      ))}
    </span>
  )
}

function Gallery({ nft }: { nft: NftDetail }) {
  const [view, setView] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row lg:items-center lg:gap-7">
      <div role="tablist" aria-label="Vistas da obra" className="flex gap-4 lg:flex-col">
        {VIEWS.map((v, i) => (
          <button
            key={v.label}
            type="button"
            role="tab"
            aria-selected={i === view}
            aria-label={v.label}
            onClick={() => setView(i)}
            className={cn('size-[72px] overflow-hidden rounded-lg bg-surface md:size-[100px]', i === view && 'outline outline-1 -outline-offset-1 outline-brand')}
          >
            <NftArtwork artwork={nft.artwork} alt="" sizes="100px" className="size-full rounded-lg" />
          </button>
        ))}
      </div>
      <div className="relative flex aspect-square w-full max-w-[444px] items-center justify-center rounded-md bg-surface p-4">
        <div className="size-full overflow-hidden rounded-3xl">
          <NftArtwork
            artwork={nft.artwork}
            alt={`${nft.name} — ${VIEWS[view].label.toLowerCase()}`}
            priority
            sizes="(max-width: 767px) 90vw, 404px"
            className="size-full transition-transform duration-300"
            style={VIEWS[view].style}
          />
        </div>
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          aria-label="Ampliar imagem"
          className="absolute top-3 right-[34px] flex size-[30px] items-center justify-center rounded-full bg-ink/60 text-cream hover:text-brand-light"
        >
          <Zoom className="size-5" />
        </button>
      </div>
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[min(92vw,900px)] p-4 sm:max-w-[min(92vw,900px)]">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada da obra.</DialogDescription>
          <img src={artworkSrc(nft.artwork, 960)} alt={nft.name} width={960} height={960} className="aspect-square w-full rounded-2xl object-cover" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ShareLinks({ nft }: { nft: NftDetail }) {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const text = encodeURIComponent(`${nft.name} na Kurio`)
  const links = [
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, Icon: Linkedin, cls: 'h-3.5 w-[15px]' },
    { label: 'e-mail', href: `mailto:?subject=${text}&body=${encodeURIComponent(url)}`, Icon: Message, cls: 'size-[18px]' },
    { label: 'X (Twitter)', href: `https://x.com/intent/post?text=${text}&url=${encodeURIComponent(url)}`, Icon: Twitter, cls: 'h-3 w-4' },
  ]
  return (
    <div className="flex items-center gap-2">
      <span className="text-[15px] leading-4 font-bold text-cream">Compartilhar este NFT:</span>
      {links.map(({ label, href, Icon, cls }) => (
        <a
          key={label}
          href={href}
          target={href.startsWith('mailto') ? undefined : '_blank'}
          rel="noopener noreferrer"
          aria-label={`Compartilhar por ${label}${href.startsWith('mailto') ? '' : ' (abre em nova aba)'}`}
          className="flex size-6 items-center justify-center text-cream hover:text-brand-light"
        >
          <Icon className={cls} />
        </a>
      ))}
    </div>
  )
}

function DetailTabs({ nft }: { nft: NftDetail }) {
  const [tab, setTab] = useState<'detalhes' | 'avaliacoes'>('detalhes')
  const tabs = [
    { id: 'detalhes' as const, label: 'Detalhes do NFT' },
    { id: 'avaliacoes' as const, label: `Avaliações de colecionadores (${nft.reviewsCount})` },
  ]
  return (
    <section aria-label="Informações do NFT" className="flex flex-col gap-3">
      <div role="tablist" className="flex gap-8 border-b border-brand/30">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn('relative pb-3 text-[17px] leading-4', tab === t.id ? 'font-bold text-brand-light' : 'text-cream hover:text-brand-light')}
          >
            {t.label}
            {tab === t.id && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[3px] bg-brand" />}
          </button>
        ))}
      </div>
      {tab === 'detalhes' ? (
        <div id="panel-detalhes" role="tabpanel" aria-labelledby="tab-detalhes" className="flex flex-col text-sm leading-6 text-sand">
          {nft.story.map((p) => (
            <p key={p.slice(0, 20)} className="mb-6 last:mb-3">
              {p}
            </p>
          ))}
          <h3 className="font-bold text-cream">Rede:</h3>
          <p className="mb-3">Cunhado na {NETWORK_LABELS[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p>
          <h3 className="font-bold text-cream">Contrato:</h3>
          <p className="mb-3">Direitos autorais do criador: {nft.royaltiesPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
          <h3 className="font-bold text-cream">Direitos autorais:</h3>
          <p>{nft.contract.replace('…', '...')} • Contrato inteligente ERC-721 verificado.</p>
        </div>
      ) : (
        <div id="panel-avaliacoes" role="tabpanel" aria-labelledby="tab-avaliacoes">
          <ul className="flex flex-col divide-y divide-line">
            {nft.reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-cream">{r.author}</span>
                  <Stars rating={r.rating} />
                  <span className="sr-only">{r.rating} de 5 estrelas</span>
                  <time dateTime={r.date} className="text-xs text-khaki">
                    {new Date(r.date).toLocaleDateString('pt-BR')}
                  </time>
                </div>
                <p className="text-sm leading-6 text-sand">{r.text}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-khaki">Exibindo as {nft.reviews.length} avaliações mais recentes de {nft.reviewsCount}.</p>
        </div>
      )}
    </section>
  )
}

function DesktopDetail({ nft, editionParam }: { nft: NftDetail; editionParam?: string }) {
  const editionLabelId = useId()
  const state = useEditionState(nft, editionParam)
  const { buy, error, pending } = useBuy(nft)
  const favorite = useIsFavorite(nft.id)
  const toggleFavorite = useToggleFavorite()
  const related = useRelated(nft.id)
  const remaining = state.edition?.available ?? 0

  return (
    <PageShell className="flex flex-col gap-24 pt-8">
      <div className="flex flex-col gap-3">
        <nav aria-label="Trilha de navegação">
          <ol className="flex gap-1 text-[15px] leading-4 font-bold text-cream">
            <li>
              <Link to="/" className="hover:text-brand-light">
                Início
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link to="/" hash="catalogo" className="hover:text-brand-light">
                Mercado
              </Link>
            </li>
          </ol>
        </nav>
        <div className="grid gap-8 lg:grid-cols-[573px_minmax(0,1fr)]">
          <Gallery nft={nft} />
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 border-b border-brand/30 pb-3">
              <h1 className="text-[28px] leading-[37px] font-bold text-cream">{nft.name}</h1>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[22px] leading-4 font-bold text-brand-light" aria-live="polite" data-testid="detail-price">
                  {state.edition ? formatEth(state.edition.price) : formatEth(nft.price)}
                </p>
                <p className="flex items-center gap-1 text-[15px] leading-5 text-cream">
                  <Stars rating={nft.rating} />
                  <span className="sr-only">Nota {nft.rating} de 5.</span> {nft.reviewsCount} avaliações de colecionadores
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-[15px] leading-4 font-bold text-cream">Sobre este NFT:</h2>
              <p className="text-sm leading-6 text-sand">{nft.description}</p>
            </div>
            <div className="flex flex-col gap-3">
              <h2 id={editionLabelId} className="text-[15px] leading-4 font-bold text-cream">
                Edição:
              </h2>
              <EditionPicker editions={nft.editions} value={state.edition?.id ?? ''} onChange={state.select} labelId={editionLabelId} />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <QuantityStepper value={state.quantity} max={state.max} onChange={state.setQuantity} label="Quantidade" disabled={state.soldOut} />
                <p className="text-xs text-khaki" aria-live="polite">
                  {state.soldOut ? 'Todas as edições estão esgotadas.' : `Disponível: ${remaining} • máx. ${nft.maxPerOrder} por pedido`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => buy(state.edition, state.quantity, true)}
                  disabled={state.soldOut || pending}
                  className="h-10 w-[130px] rounded-md bg-brand text-sm leading-5 font-bold text-ink hover:bg-brand-light disabled:opacity-50"
                >
                  {pending ? 'ADICIONANDO…' : 'COMPRAR'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite.toggle(nft.id, nft.name, favorite)}
                  aria-pressed={favorite}
                  className="flex h-10 w-[130px] items-center justify-center gap-2 rounded-md border border-brand text-sm leading-5 font-medium text-brand-light hover:bg-brand/10"
                >
                  <Heart className="size-5" />
                  {favorite ? 'Favorito' : 'Favoritar'}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-coral">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <dl className="flex flex-col gap-3 text-[15px] leading-5 text-khaki">
                <div className="flex gap-1">
                  <dt>ID do token:</dt>
                  <dd>{nft.tokenId}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Coleção:</dt>
                  <dd>{nft.collectionName}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Atributos:</dt>
                  <dd>{nft.attributes.join(', ')}</dd>
                </div>
              </dl>
              <ShareLinks nft={nft} />
            </div>
          </div>
        </div>
      </div>
      <DetailTabs nft={nft} />
      <NftCarousel title="Mais desta coleção" items={related.data} isPending={related.isPending} error={related.error} onRetry={() => void related.refetch()} />
    </PageShell>
  )
}

function MobileDetail({ nft, editionParam }: { nft: NftDetail; editionParam?: string }) {
  const editionLabelId = useId()
  const router = useRouter()
  const state = useEditionState(nft, editionParam)
  const { buy, error, pending } = useBuy(nft)
  const favorite = useIsFavorite(nft.id)
  const toggleFavorite = useToggleFavorite()
  const [view, setView] = useState(0)
  const roundButton = 'flex size-[35px] items-center justify-center rounded-full border border-line bg-surface-2 text-khaki'

  return (
    <div className="min-h-dvh bg-ink pb-[180px]">
      <main id="conteudo" tabIndex={-1} className="focus:outline-none">
        <div className="relative bg-[linear-gradient(180deg,#241612,#2f1d15)] px-7 pt-6 pb-[132px]">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: '/' }))} aria-label="Voltar" className={roundButton}>
              <ArrowLeft2 className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => toggleFavorite.toggle(nft.id, nft.name, favorite)}
              aria-pressed={favorite}
              aria-label={favorite ? 'Remover da lista de interesse' : 'Adicionar à lista de interesse'}
              className={cn(roundButton, favorite && 'text-brand-light')}
            >
              <Heart className="size-4" />
            </button>
          </div>
          <div className="mt-2 overflow-hidden rounded-3xl">
            <NftArtwork artwork={nft.artwork} alt={nft.name} priority sizes="90vw" className="w-full transition-transform duration-300" style={VIEWS[view].style} />
          </div>
          <div className="absolute bottom-[132px] left-1/2 flex -translate-x-1/2 translate-y-[-26px] items-center gap-0" role="tablist" aria-label="Vistas da obra">
            {VIEWS.slice(0, 3).map((v, i) => (
              <button key={v.label} type="button" role="tab" aria-selected={view === i} aria-label={v.label} onClick={() => setView(i)} className="flex h-6 min-w-6 items-center justify-center">
                <span className={cn('block h-[7px] rounded-full bg-brand', view === i ? 'w-7' : 'w-[7px]')} />
              </button>
            ))}
          </div>
        </div>
        <section className="relative -mt-[114px] flex flex-col gap-3 rounded-t-[31px] bg-surface px-6 pt-8 pb-8">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl leading-6 font-bold text-cream">{nft.name}</h1>
            <p className="flex h-[27px] shrink-0 items-center gap-1 rounded-[32px] border border-brand px-1.5 text-sm">
              <Star className="size-3.5 text-brand" />
              <span className="font-medium text-cream">{nft.rating.toFixed(1)}</span>
              <span className="text-sand">({nft.reviewsCount})</span>
              <span className="sr-only">avaliações</span>
            </p>
          </div>
          <p className="text-sm leading-6 text-sand">{nft.description}</p>
          <h2 id={editionLabelId} className="text-[15px] leading-4 font-bold text-cream">
            Edição:
          </h2>
          <EditionPicker editions={nft.editions} value={state.edition?.id ?? ''} onChange={state.select} labelId={editionLabelId} />
          <dl className="mt-1 flex flex-col gap-3 text-[15px] leading-5 text-khaki">
            <div className="flex gap-1">
              <dt>ID do token:</dt>
              <dd>{nft.tokenId}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Coleção:</dt>
              <dd>{nft.collectionName}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Atributos:</dt>
              <dd>{nft.attributes.join(', ')}</dd>
            </div>
          </dl>
          {error && (
            <p role="alert" className="text-sm text-coral">
              {error}
            </p>
          )}
        </section>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-5 rounded-t-[40px] bg-surface px-6 pt-5 pb-9 shadow-glow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[15px] leading-4 font-medium text-sand">Qtd.</span>
            <QuantityStepper size="md" value={state.quantity} max={state.max} onChange={state.setQuantity} label="Quantidade" disabled={state.soldOut} />
          </div>
          <p className="text-xl leading-4 font-bold text-brand-light" aria-live="polite" data-testid="detail-price">
            {state.edition ? formatEth(state.edition.price) : formatEth(nft.price)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => buy(state.edition, state.quantity, true)}
            disabled={state.soldOut || pending}
            className="h-[60px] flex-1 rounded-[40px] bg-[linear-gradient(90deg,#d28a4c,rgb(210_138_76/0.8))] text-base leading-5 font-bold text-ink disabled:opacity-50 sm:max-w-[196px]"
          >
            {state.soldOut ? 'Esgotado' : 'Comprar NFT'}
          </button>
          <button
            type="button"
            onClick={() => buy(state.edition, state.quantity, false)}
            disabled={state.soldOut || pending}
            aria-label="Adicionar ao carrinho"
            className="flex size-[60px] items-center justify-center rounded-full border border-line bg-surface-2 text-sand disabled:opacity-50"
          >
            <TabShop className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function NftDetailPage({ nftId, editionParam }: { nftId: string; editionParam?: string }) {
  const isDesktop = useIsDesktop()
  const { data: nft, isPending, error, refetch, isFetching } = useNftDetail(nftId)

  if (isPending) return <DetailSkeleton desktop={isDesktop} />
  if (!nft) {
    if (isApiError(error) && error.status === 404) {
      return <NotFound title="NFT não encontrado" description="Este NFT não existe ou foi removido do mercado. Explore outras obras no catálogo." />
    }
    return (
      <PageShell>
        <ErrorState className="mt-16" title="Não foi possível carregar este NFT" error={error} onRetry={() => void refetch()} retrying={isFetching} />
      </PageShell>
    )
  }
  return isDesktop ? <DesktopDetail key={nft.id} nft={nft} editionParam={editionParam} /> : <MobileDetail key={nft.id} nft={nft} editionParam={editionParam} />
}

function DetailSkeleton({ desktop }: { desktop: boolean }) {
  if (!desktop) {
    return (
      <div className="flex min-h-dvh flex-col gap-4 px-7 pt-6" aria-busy="true" aria-label="Carregando NFT">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-7 w-3/4" />
      </div>
    )
  }
  return (
    <PageShell className="pt-8">
      <div className="grid gap-8 pt-7 lg:grid-cols-[573px_minmax(0,1fr)]" aria-busy="true" aria-label="Carregando NFT">
        <div className="flex gap-7">
          <div className="hidden flex-col gap-4 lg:flex">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-[100px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="aspect-square w-full max-w-[444px] rounded-md" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-1/2" />
        </div>
      </div>
    </PageShell>
  )
}
