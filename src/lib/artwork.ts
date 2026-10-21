import type { ArtworkKey } from '@/api/contracts'

/** Larguras geradas por scripts/optimize-images.mjs em public/nfts. */
export const ARTWORK_WIDTHS = [160, 320, 640, 960] as const

export function artworkSrc(artwork: ArtworkKey, width: (typeof ARTWORK_WIDTHS)[number] = 640) {
  return `/nfts/${artwork}-${width}.webp`
}
