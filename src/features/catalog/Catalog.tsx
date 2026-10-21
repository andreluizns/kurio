import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { CatalogSort, CatalogTab } from '@/api/contracts'
import { ChevronDown, Filter, Search } from '@/components/icons'
import { ErrorState } from '@/components/feedback/ErrorState'
import { NftArtwork } from '@/components/nft/NftArtwork'
import { NftCard, NftCardSkeleton } from '@/components/nft/NftCard'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { CatalogFilters } from './Filters'
import { Pagination } from './Pagination'
import { useCatalog, useHighlights } from './queries'
import { COLLECTION_LABELS, NETWORK_LABELS, SORT_LABELS, TAB_LABELS, toCatalogQuery, type CatalogSearch } from './search-params'

export interface CatalogProps {
  search: CatalogSearch
  onChange: (patch: Partial<CatalogSearch>, options?: { resetPage?: boolean }) => void
}

function Tabs({ tab, onChange, mobile = false }: { tab: CatalogTab; onChange: (tab: CatalogTab) => void; mobile?: boolean }) {
  return (
    <div role="tablist" aria-label="Seções do catálogo" className={cn('flex', mobile ? 'gap-4' : 'gap-5')}>
      {(Object.keys(TAB_LABELS) as CatalogTab[]).map((t) => {
        const active = t === tab
        return (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t)}
            className={cn(
              'relative pb-1 text-[15px] leading-4 whitespace-nowrap transition-colors hover:text-brand-light',
              mobile && 'text-sm',
              active ? (mobile ? 'font-bold text-brand-light' : 'font-medium text-brand-light') : mobile ? 'text-cream' : 'font-medium text-cream',
            )}
          >
            {TAB_LABELS[t]}
            {active && <span aria-hidden className="absolute inset-x-0 -bottom-1 h-0.5 bg-brand" />}
          </button>
        )
      })}
    </div>
  )
}

function SortSelect({ sort, onChange }: { sort: CatalogSort; onChange: (s: CatalogSort) => void }) {
  return (
    <div className="flex items-center gap-1 text-[15px] leading-5 text-cream">
      <span id="sort-label">Ordenar por:</span>
      <Select value={sort} onValueChange={(v) => onChange(v as CatalogSort)}>
        <SelectTrigger
          aria-labelledby="sort-label"
          className="h-auto w-auto gap-1 border-0 px-0 text-[15px] [&>svg]:hidden"
          data-testid="sort-trigger"
        >
          <SelectValue />
          <ChevronDown className="size-4 text-cream" />
        </SelectTrigger>
        <SelectContent align="end" position="popper">
          {(Object.keys(SORT_LABELS) as CatalogSort[]).map((s) => (
            <SelectItem key={s} value={s}>
              {SORT_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function FeaturedBanner() {
  const { data } = useHighlights()
  const featured = data?.featured
  return (
    <aside aria-labelledby="featured-title" className="relative hidden flex-col gap-4 bg-[linear-gradient(180deg,rgb(210_138_76/0.1),rgb(210_138_76/0.03))] pt-6 pb-1 lg:flex">
      <div className="flex flex-col gap-4 px-5">
        <h2 id="featured-title" className="text-2xl leading-8 font-bold text-brand-light">
          NFT EM DESTAQUE
        </h2>
        <p className="text-center text-[22px] leading-4 font-bold text-cream">OFERTA LIMITADA</p>
      </div>
      {featured ? (
        <Link to="/nft/$nftId" params={{ nftId: featured.id }} aria-label={`Ver ${featured.name} em destaque`}>
          <NftArtwork artwork={featured.artwork} alt="" sizes="310px" className="aspect-[310/368] w-full rounded-[22px]" />
        </Link>
      ) : (
        <Skeleton className="aspect-[310/368] w-full rounded-[22px]" />
      )}
    </aside>
  )
}

function ActiveFilters({ search, onChange }: CatalogProps) {
  const chips: { label: string; clear: Partial<CatalogSearch> }[] = []
  if (search.q) chips.push({ label: `Busca: “${search.q}”`, clear: { q: undefined } })
  for (const c of search.collections?.split(',') ?? []) {
    chips.push({
      label: COLLECTION_LABELS[c as keyof typeof COLLECTION_LABELS],
      clear: { collections: search.collections!.split(',').filter((x) => x !== c).join(',') || undefined },
    })
  }
  for (const n of search.networks?.split(',') ?? []) {
    chips.push({
      label: NETWORK_LABELS[n as keyof typeof NETWORK_LABELS],
      clear: { networks: search.networks!.split(',').filter((x) => x !== n).join(',') || undefined },
    })
  }
  if (search.min !== undefined || search.max !== undefined) {
    chips.push({ label: `Preço: ${search.min ?? 0} – ${search.max ?? '12.3'} ETH`, clear: { min: undefined, max: undefined } })
  }
  if (!chips.length) return null
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <li key={chip.label}>
          <button
            type="button"
            onClick={() => onChange(chip.clear)}
            className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-sand hover:border-brand hover:text-cream"
            aria-label={`Remover filtro ${chip.label}`}
          >
            {chip.label} <span aria-hidden>×</span>
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => onChange({ q: undefined, collections: undefined, networks: undefined, min: undefined, max: undefined })}
          className="px-2 text-xs text-brand-light underline-offset-4 hover:underline"
        >
          Limpar tudo
        </button>
      </li>
    </ul>
  )
}

function Results({ search, onChange, variant }: CatalogProps & { variant: 'grid' | 'mobile' }) {
  const query = toCatalogQuery(search)
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData, isRefetchError } = useCatalog(query)
  const mobile = variant === 'mobile'
  const gridClass = mobile ? 'grid grid-cols-2 gap-x-4 gap-y-6 pb-8 [&>*:nth-child(even)]:translate-y-8' : 'grid grid-cols-2 gap-x-8 gap-y-[72px] lg:grid-cols-3'

  if (isPending) {
    return (
      <div className={gridClass} aria-busy="true" aria-label="Carregando NFTs">
        {Array.from({ length: 9 }, (_, i) => (
          <NftCardSkeleton key={i} variant={variant} />
        ))}
      </div>
    )
  }
  if (isError && !data) {
    return <ErrorState title="Não foi possível carregar o catálogo" error={error} onRetry={() => void refetch()} retrying={isFetching} />
  }
  if (!data.items.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-line px-6 py-16 text-center" role="status">
        <Search className="size-6 text-khaki" />
        <h3 className="text-base font-bold text-cream">Nenhum NFT encontrado</h3>
        <p className="max-w-sm text-sm leading-6 text-sand">Ajuste a busca ou os filtros para ver mais resultados.</p>
        <button
          type="button"
          onClick={() => onChange({ q: undefined, collections: undefined, networks: undefined, min: undefined, max: undefined, tab: undefined })}
          className="mt-1 rounded-md bg-brand px-5 py-2 text-sm font-bold text-ink hover:bg-brand-light"
        >
          Limpar filtros
        </button>
      </div>
    )
  }

  const updating = isFetching && isPlaceholderData
  return (
    <div className="flex flex-col gap-[88px]">
      <div>
        <p className="sr-only" aria-live="polite">
          {updating ? 'Atualizando resultados…' : `${data.total} NFTs encontrados. Página ${data.page} de ${data.totalPages}.`}
        </p>
        {isRefetchError && (
          <p role="alert" className="mb-4 rounded border border-coral/40 px-3 py-2 text-sm text-coral">
            Não foi possível atualizar os resultados. Exibindo os dados mais recentes disponíveis.
          </p>
        )}
        <div className={cn(gridClass, 'transition-opacity', updating && 'opacity-60')} aria-busy={updating} data-testid="catalog-grid">
          {data.items.map((nft, i) => (
            <NftCard key={nft.id} nft={nft} variant={variant} priority={i < 3} />
          ))}
        </div>
      </div>
      {!mobile && <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => onChange({ page }, { resetPage: false })} />}
      {mobile && (
        <div className="flex justify-center pb-4">
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => onChange({ page }, { resetPage: false })} />
        </div>
      )}
    </div>
  )
}

/** Seção de catálogo desktop/tablet: filtros laterais (≥1024 px) ou em gaveta. */
export function DesktopCatalog({ search, onChange }: CatalogProps) {
  const { data, isPending } = useCatalog(toCatalogQuery(search))
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <section id="catalogo" aria-labelledby="catalog-title" className="hidden scroll-mt-6 gap-12 md:flex">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="hidden w-[310px] shrink-0 flex-col gap-6 lg:flex">
        <div className="bg-surface p-5">
          <CatalogFilters search={search} facets={data?.facets} loading={isPending} onChange={onChange} />
        </div>
        <FeaturedBanner />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs tab={search.tab ?? 'todos'} onChange={(tab) => onChange({ tab: tab === 'todos' ? undefined : tab })} />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm text-cream lg:hidden"
            >
              <Filter className="size-4" /> Filtros
            </button>
            <SortSelect sort={search.sort ?? 'recentes'} onChange={(sort) => onChange({ sort: sort === 'recentes' ? undefined : sort })} />
          </div>
        </div>
        <ActiveFilters search={search} onChange={onChange} />
        <Results search={search} onChange={onChange} variant="grid" />
      </div>
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[340px] overflow-y-auto p-6">
          <SheetHeader className="p-0">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Combine coleções, faixa de preço e rede.</SheetDescription>
          </SheetHeader>
          <CatalogFilters search={search} facets={data?.facets} loading={isPending} onChange={onChange} />
        </SheetContent>
      </Sheet>
    </section>
  )
}

/** Catálogo no layout mobile: abas, grade de 2 colunas e filtros em gaveta inferior. */
export function MobileCatalog({ search, onChange, filtersOpen, onFiltersOpenChange }: CatalogProps & { filtersOpen: boolean; onFiltersOpenChange: (open: boolean) => void }) {
  const { data, isPending } = useCatalog(toCatalogQuery(search))
  return (
    <section id="catalogo-mobile" aria-labelledby="catalog-title-mobile" className="flex flex-col gap-4 md:hidden">
      <h2 id="catalog-title-mobile" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <Tabs mobile tab={search.tab ?? 'todos'} onChange={(tab) => onChange({ tab: tab === 'todos' ? undefined : tab })} />
      </div>
      <ActiveFilters search={search} onChange={onChange} />
      <Results search={search} onChange={onChange} variant="mobile" />
      <Sheet open={filtersOpen} onOpenChange={onFiltersOpenChange}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-[31px] p-6">
          <SheetHeader className="p-0">
            <SheetTitle>Filtros e ordenação</SheetTitle>
            <SheetDescription>Os filtros são aplicados imediatamente.</SheetDescription>
          </SheetHeader>
          <SortSelect sort={search.sort ?? 'recentes'} onChange={(sort) => onChange({ sort: sort === 'recentes' ? undefined : sort })} />
          <CatalogFilters search={search} facets={data?.facets} loading={isPending} onChange={onChange} />
          <button type="button" onClick={() => onFiltersOpenChange(false)} className="h-12 rounded-[40px] bg-brand text-base font-bold text-ink">
            Ver resultados{data ? ` (${data.total})` : ''}
          </button>
        </SheetContent>
      </Sheet>
    </section>
  )
}
