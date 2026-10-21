import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { HeroSlide } from '@/api/contracts'
import { ArrowRight } from '@/components/icons'
import { NftArtwork } from '@/components/nft/NftArtwork'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useHighlights } from './queries'

function Dots({ count, active, onSelect, className }: { count: number; active: number; onSelect: (i: number) => void; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)} role="tablist" aria-label="Destaques">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={`Destaque ${i + 1} de ${count}`}
          onClick={() => onSelect(i)}
          className="flex size-6 items-center justify-center"
        >
          <span className={cn('block size-2 rounded-full bg-brand transition-opacity', i === active ? 'opacity-100' : 'opacity-40')} />
        </button>
      ))}
    </div>
  )
}

/** Hero desktop: texto + arte 450×450, com carrossel manual de destaques (sem autoplay). */
export function DesktopHero() {
  const { data, isPending } = useHighlights()
  const [index, setIndex] = useState(0)
  const slide: HeroSlide | undefined = data?.slides[index]

  if (isPending || !data || !slide) {
    return (
      <section aria-busy="true" aria-label="Destaques" className="hidden h-[450px] items-center justify-between gap-12 pl-10 md:flex">
        <div className="flex w-full max-w-[600px] flex-col gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-[140px] w-full" />
          <Skeleton className="h-16 w-4/5" />
          <Skeleton className="h-10 w-[140px]" />
        </div>
        <Skeleton className="aspect-square h-full rounded-3xl" />
      </section>
    )
  }

  return (
    <section aria-roledescription="carrossel" aria-label="Destaques" className="hidden h-[450px] items-center justify-between gap-8 pl-10 md:flex lg:gap-[110px]">
      <div className="flex w-full max-w-[600px] flex-col items-end gap-11" aria-live="polite">
        <div className="flex w-full flex-col gap-8">
          <div className="flex flex-col gap-1">
            <div className="flex flex-col gap-2">
              <p className="text-sm leading-4 font-medium tracking-[0.1em] text-cream">{slide.eyebrow}</p>
              <h1 className="text-[32px] leading-[52px] font-bold whitespace-pre-line text-cream lg:text-[43px] lg:leading-[70px]">{slide.title}</h1>
            </div>
            <p className="max-w-[557px] text-sm leading-6 text-sand">{slide.description}</p>
          </div>
          <Link
            to="/"
            hash="catalogo"
            className="flex h-10 w-[140px] items-center justify-center rounded-md bg-brand text-base leading-5 font-bold text-ink hover:bg-brand-light"
          >
            EXPLORAR
          </Link>
        </div>
        <Dots count={data.slides.length} active={index} onSelect={setIndex} className="-mr-2" />
      </div>
      <Link to="/nft/$nftId" params={{ nftId: slide.nftId }} className="shrink-0" aria-label={`Ver destaque: ${slide.title.replace('\n', ' ')}`}>
        <NftArtwork artwork={slide.artwork} alt="" priority sizes="450px" className="size-[300px] rounded-3xl lg:size-[450px]" />
      </Link>
    </section>
  )
}

/** Banner do hero no layout mobile. */
export function MobileHero() {
  const { data, isPending } = useHighlights()
  const [index, setIndex] = useState(0)
  const slide = data?.slides[index]

  if (isPending || !slide) return <Skeleton className="h-[190px] w-full rounded-xl md:hidden" />

  const secondary = slide.artwork === 'nomad' ? 'emerald' : 'nomad'
  return (
    <section aria-label="Destaques" className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(180deg,rgb(210_138_76/0.2),rgb(210_138_76/0.1))] p-4 md:hidden">
      <span aria-hidden className="absolute -top-8 -left-20 size-[248px] rounded-full bg-[radial-gradient(circle,rgb(221_154_95/0.43),rgb(210_138_76/0.04)_70%)]" />
      <span aria-hidden className="absolute -top-2.5 left-[73px] size-[248px] rounded-full bg-[radial-gradient(circle,rgb(221_154_95/0.37),transparent_70%)]" />
      <div className="relative flex flex-col items-center gap-4">
        <div className="flex w-full items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-xs leading-4 font-medium text-cream">{slide.eyebrow}</p>
            <h1 className="mt-1.5 text-lg leading-[29px] font-bold whitespace-pre-line text-cream">
              {slide.id === 'slide-emerald' ? 'SEJA DONO DA\nCULTURA DIGITAL' : slide.title}
            </h1>
            <p className="mt-1.5 line-clamp-3 text-xs leading-[18px] text-sand">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <Link to="/" hash="catalogo" className="mt-1 flex items-center gap-2 text-xs leading-[14px] font-bold text-brand-light">
              EXPLORAR <ArrowRight className="size-4 text-brand-light" />
            </Link>
          </div>
          <Link to="/nft/$nftId" params={{ nftId: slide.nftId }} className="relative h-[146px] w-[138px] shrink-0" aria-label="Ver destaque">
            <NftArtwork artwork={slide.artwork} alt="" priority sizes="138px" className="size-[138px] rounded-2xl" />
            <NftArtwork artwork={secondary} alt="" sizes="58px" className="absolute bottom-0 left-3.5 size-[58px] rounded-2xl" />
          </Link>
        </div>
        <Dots count={data.slides.length} active={index} onSelect={setIndex} className="-my-2 gap-0" />
      </div>
    </section>
  )
}
