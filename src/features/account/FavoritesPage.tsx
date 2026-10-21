import { Link } from '@tanstack/react-router'
import { ErrorState } from '@/components/feedback/ErrorState'
import { NftCard, NftCardSkeleton } from '@/components/nft/NftCard'
import { useFavorites } from '@/features/favorites/use-favorites'

export function FavoritesPage() {
  const { data, isPending, error, refetch, isFetching } = useFavorites()
  return (
    <section aria-labelledby="favorites-title" className="flex flex-col gap-8">
      <h1 id="favorites-title" className="text-base leading-4 font-bold text-cream">
        Lista de interesse
      </h1>
      {error && !data ? (
        <ErrorState title="Não foi possível carregar seus favoritos" error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : isPending ? (
        <div className="grid grid-cols-2 gap-8 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      ) : data && data.items.length ? (
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 xl:grid-cols-3" data-testid="favorites-grid">
          {data.items.map((nft) => (
            <NftCard key={nft.id} nft={nft} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3" role="status">
          <p className="text-sm text-sand">Você ainda não favoritou nenhum NFT.</p>
          <Link to="/" hash="catalogo" className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-ink">
            Explorar NFTs
          </Link>
        </div>
      )}
    </section>
  )
}
