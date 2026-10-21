import type { CSSProperties } from 'react'
import type { ArtworkKey } from '@/api/contracts'
import { ARTWORK_WIDTHS as WIDTHS, artworkSrc } from '@/lib/artwork'
import { cn } from '@/lib/utils'


/**
 * Arte do NFT em WebP responsivo (variantes geradas de design/images por scripts/optimize-images.mjs).
 * Dimensões explícitas + aspect-ratio evitam deslocamento de layout.
 */
export function NftArtwork({
  artwork,
  alt,
  sizes,
  priority = false,
  className,
  style,
}: {
  artwork: ArtworkKey
  alt: string
  sizes: string
  priority?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <img
      src={artworkSrc(artwork, 640)}
      srcSet={WIDTHS.map((w) => `${artworkSrc(artwork, w)} ${w}w`).join(', ')}
      sizes={sizes}
      alt={alt}
      width={640}
      height={640}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
      style={style}
      className={cn('aspect-square object-cover', className)}
    />
  )
}
