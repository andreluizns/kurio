import { useState } from 'react'
import { Filter, Search } from '@/components/icons'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { PageShell } from '@/components/layout/PageShell'
import { useIsDesktop } from '@/lib/use-media-query'
import { DesktopCatalog, MobileCatalog } from './Catalog'
import { Blog, Promos } from './Editorial'
import { DesktopHero, MobileHero } from './Hero'
import type { CatalogSearch } from './search-params'
import { useCatalogNavigation } from './use-catalog-navigation'

function MobileSearchBar({ initial, onSubmit, onOpenFilters }: { initial?: string; onSubmit: (q?: string) => void; onOpenFilters: () => void }) {
  const [value, setValue] = useState(initial ?? '')
  return (
    <div className="flex h-[45px] gap-2">
      <form
        role="search"
        className="flex flex-1 items-center gap-2 rounded-[10px] bg-surface px-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(value.trim() || undefined)
        }}
      >
        <Search className="size-[22px] shrink-0 text-khaki" />
        <label htmlFor="mobile-search" className="sr-only">
          Explorar coleções
        </label>
        <input
          id="mobile-search"
          type="search"
          enterKeyHint="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Explorar coleções"
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-cream placeholder:text-khaki focus:outline-none"
        />
      </form>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label="Filtros e ordenação"
        className="flex size-[45px] shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(180deg,rgb(210_138_76/0.45),#d28a4c)] text-ink"
      >
        <Filter className="size-[22px]" />
      </button>
    </div>
  )
}

export function HomePage({ search }: { search: CatalogSearch }) {
  const isDesktop = useIsDesktop()
  const onChange = useCatalogNavigation(search)
  const [filtersOpen, setFiltersOpen] = useState(false)

  if (!isDesktop) {
    return (
      <div className="min-h-dvh px-6 pt-10 pb-[140px]">
        <main id="conteudo" tabIndex={-1} className="flex flex-col gap-4 focus:outline-none">
          <h1 className="sr-only">Kurio — marketplace de NFTs</h1>
          <MobileSearchBar key={search.q ?? ''} initial={search.q} onSubmit={(q) => onChange({ q })} onOpenFilters={() => setFiltersOpen(true)} />
          <MobileHero />
          <MobileCatalog search={search} onChange={onChange} filtersOpen={filtersOpen} onFiltersOpenChange={setFiltersOpen} />
        </main>
        <MobileTabBar />
      </div>
    )
  }

  return (
    <PageShell divider className="flex flex-col gap-24 pt-8">
      <DesktopHero />
      <DesktopCatalog search={search} onChange={onChange} />
      <Promos />
      <Blog />
    </PageShell>
  )
}
