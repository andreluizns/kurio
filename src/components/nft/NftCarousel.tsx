import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { NftArtwork } from './NftArtwork'

const PER_PAGE = 5

/** Faixa horizontal de NFTs (5 por página no desktop, rolagem no mobile/tablet) com indicadores. */
export function NftCarousel({
  title,
  items,
  isPending,
  error,
  onRetry,
}: {
  title: string
  items?: NftSummary[]
  isPending: boolean
  error?: unknown
  onRetry?: () => void
}) {
  const [page, setPage] = useState(0)
  const pages = items ? Math.max(1, Math.ceil(items.length / PER_PAGE)) : 3
  const visible = items?.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)
  const headingId = `carousel-${title.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 border-b border-brand/30 pb-3">
        <h2 id={headingId} className="text-[17px] leading-4 font-bold text-brand-light">
          {title}
        </h2>
      </div>
      {error && !items ? (
        <ErrorState title="Não foi possível carregar as sugestões" error={error} onRetry={onRetry} />
      ) : (
        <div className="flex flex-col items-center gap-8">
          <ul className="-mx-4 flex w-[calc(100%+2rem)] snap-x gap-7 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:w-full lg:grid-cols-5 lg:overflow-visible lg:px-0">
            {isPending || !visible
              ? Array.from({ length: PER_PAGE }, (_, i) => (
                  <li key={i} className="flex w-[180px] shrink-0 flex-col gap-3 lg:w-auto">
                    <Skeleton className="aspect-[220/255] w-full rounded-none" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </li>
                ))
              : visible.map((nft) => (
                  <li key={nft.id} className="relative flex w-[180px] shrink-0 snap-start flex-col gap-3 lg:w-auto">
                    <div className="flex aspect-[220/255] items-center justify-center bg-surface px-1">
                      <NftArtwork artwork={nft.artwork} alt="" sizes="(max-width: 1023px) 180px, 212px" className="w-full rounded-[11px]" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-[15px] leading-5 text-cream">
                        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0">
                          {nft.name}
                        </Link>
                      </h3>
                      <p className="text-base leading-4 font-bold text-brand-light">{formatEth(nft.price)}</p>
                    </div>
                  </li>
                ))}
          </ul>
          {pages > 1 && (
            <div className="hidden items-center gap-1 lg:flex" role="tablist" aria-label={`Páginas de ${title}`}>
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === page}
                  aria-label={`Página ${i + 1} de ${pages}`}
                  onClick={() => setPage(i)}
                  className="flex size-5 items-center justify-center"
                >
                  <span className={cn('block size-3 rounded-full border border-brand', i === page && 'bg-brand')} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
