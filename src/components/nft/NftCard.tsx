import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { NftSummary } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { Heart, Shopping, Zoom } from '@/components/icons'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart } from '@/features/cart/use-cart'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/use-favorites'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { NftArtwork } from './NftArtwork'

export function PriceTag({ price, previousPrice, className }: { price: string; previousPrice?: string | null; className?: string }) {
  return (
    <p className={cn('flex items-center gap-3 text-lg leading-4 font-bold text-brand-light', className)}>
      <span>{formatEth(price)}</span>
      {previousPrice && (
        <span className="font-normal text-khaki line-through">
          <span className="sr-only">Preço anterior: </span>
          {formatEth(previousPrice)}
        </span>
      )}
    </p>
  )
}

const actionClass =
  'flex size-[35px] items-center justify-center rounded border border-line bg-surface-2 text-sand transition-colors hover:border-brand hover:text-brand-light disabled:opacity-60'

/** Card do catálogo (desktop e mobile). O nome é um link estendido para todo o card. */
export function NftCard({ nft, priority = false, variant = 'grid' }: { nft: NftSummary; priority?: boolean; variant?: 'grid' | 'mobile' | 'carousel' }) {
  const favorite = useIsFavorite(nft.id)
  const toggleFavorite = useToggleFavorite()
  const addToCart = useAddToCart()
  const soldOut = nft.available === 0

  const quickAdd = () =>
    addToCart.mutate(
      { nftId: nft.id, editionId: nft.defaultEditionId, quantity: 1 },
      {
        onSuccess: () => toast.success(`${nft.name} adicionado ao carrinho.`, { id: `cart-${nft.id}` }),
        onError: (error) => toast.error(isApiError(error) ? error.message : 'Não foi possível adicionar ao carrinho.', { id: `cart-${nft.id}` }),
      },
    )

  const mobile = variant === 'mobile'

  return (
    <article
      className={cn('group relative flex flex-col', mobile ? 'gap-2' : 'gap-3')}
      aria-labelledby={`nft-${nft.id}-name`}
      data-testid="nft-card"
    >
      <div
        className={cn(
          'relative flex items-start justify-center border-t border-transparent px-1 transition-colors group-focus-within:border-brand group-hover:border-brand',
          mobile ? 'rounded-[20px] bg-[linear-gradient(180deg,#241612,#2f1d15)] pt-3 pb-5' : 'bg-surface pt-6 pb-7',
        )}
      >
        <NftArtwork
          artwork={nft.artwork}
          alt=""
          priority={priority}
          sizes={mobile ? '(max-width: 767px) 45vw, 250px' : '(max-width: 767px) 45vw, (max-width: 1279px) 30vw, 250px'}
          className={cn('w-full', mobile ? 'rounded-2xl' : 'max-w-[250px] rounded-[15px]')}
        />
        {nft.rarity === 'raro' && (
          <span className={cn('absolute left-0 bg-brand px-3.5 py-1.5 text-[13px] leading-4 font-medium text-ink md:text-base', mobile ? 'top-4' : 'top-3.5')}>
            RARO
          </span>
        )}
        {soldOut && <span className="absolute top-3.5 right-2 rounded bg-ink/90 px-2 py-1 text-xs font-bold text-coral">ESGOTADO</span>}
        {mobile ? (
          <button
            type="button"
            onClick={() => toggleFavorite.toggle(nft.id, nft.name, favorite)}
            aria-pressed={favorite}
            aria-label={favorite ? `Remover ${nft.name} da lista de interesse` : `Adicionar ${nft.name} à lista de interesse`}
            className="absolute top-3 right-3 z-10 flex size-7 items-center justify-center rounded-full border border-line bg-surface-2 text-sand"
          >
            <Heart className={cn('size-3.5', favorite && 'text-brand-light')} />
          </button>
        ) : (
          <div className="absolute bottom-9 left-1/2 z-10 flex -translate-x-1/2 gap-2.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <button type="button" className={actionClass} onClick={quickAdd} disabled={soldOut || addToCart.isPending} aria-label={`Adicionar ${nft.name} ao carrinho`}>
              <Shopping className="size-5" />
            </button>
            <button
              type="button"
              className={cn(actionClass, favorite && 'text-brand-light')}
              onClick={() => toggleFavorite.toggle(nft.id, nft.name, favorite)}
              aria-pressed={favorite}
              aria-label={favorite ? `Remover ${nft.name} da lista de interesse` : `Adicionar ${nft.name} à lista de interesse`}
            >
              <Heart className="size-5" />
            </button>
            <Link to="/nft/$nftId" params={{ nftId: nft.id }} className={actionClass} aria-label={`Ver detalhes de ${nft.name}`} tabIndex={-1}>
              <Zoom className="size-5" />
            </Link>
          </div>
        )}
      </div>
      <div className={cn('flex flex-col', mobile ? 'pl-2' : 'gap-3')}>
        <h3 id={`nft-${nft.id}-name`} className={cn('text-cream', mobile ? 'text-[15px] leading-5' : 'text-base leading-4')}>
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {nft.name}
          </Link>
        </h3>
        <PriceTag price={nft.price} previousPrice={nft.previousPrice} className={mobile ? 'text-base' : undefined} />
      </div>
    </article>
  )
}

export function NftCardSkeleton({ variant = 'grid' }: { variant?: 'grid' | 'mobile' }) {
  const mobile = variant === 'mobile'
  return (
    <div className={cn('flex flex-col', mobile ? 'gap-2' : 'gap-3')} data-testid="nft-card-skeleton">
      <div className={cn('flex justify-center px-1', mobile ? 'rounded-[20px] bg-surface pt-3 pb-5' : 'bg-surface pt-6 pb-7')}>
        <Skeleton className={cn('aspect-square w-full', mobile ? 'rounded-2xl' : 'max-w-[250px] rounded-[15px]')} />
      </div>
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-4 w-2/5" />
    </div>
  )
}
