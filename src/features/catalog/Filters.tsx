import { useId, useState } from 'react'
import type { CatalogPage, CollectionSlug, Network } from '@/api/contracts'
import { COLLECTIONS, NETWORKS } from '@/api/contracts'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { COLLECTION_LABELS, NETWORK_LABELS, type CatalogSearch } from './search-params'

const PRICE_FLOOR = 0
const PRICE_CEIL = 12.3

function FacetList<T extends string>({
  title,
  values,
  labels,
  selected,
  counts,
  onToggle,
  boldCounts,
  loading,
}: {
  title: string
  values: T[]
  labels: Record<T, string>
  selected: string[]
  counts?: Map<T, number>
  onToggle: (value: T) => void
  boldCounts: boolean
  loading: boolean
}) {
  const id = useId()
  return (
    <fieldset className="flex flex-col gap-3">
      <legend id={id} className="mb-3 text-lg leading-4 font-bold text-cream">
        {title}
      </legend>
      <ul className="flex flex-col px-3">
        {values.map((value) => {
          const active = selected.includes(value)
          return (
            <li key={value}>
              <label
                className={cn(
                  'flex h-10 cursor-pointer items-center justify-between gap-2 text-[15px] transition-colors hover:text-brand-light',
                  active ? 'text-brand-light' : 'text-sand',
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={active}
                    onChange={() => onToggle(value)}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'block h-4 w-0.5 rounded-full bg-brand transition-all peer-focus-visible:w-1 peer-focus-visible:outline-2 peer-focus-visible:outline-brand-light',
                      active ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {labels[value]}
                </span>
                <span className={cn(boldCounts && 'font-bold')} aria-label={`${counts?.get(value) ?? 0} itens`}>
                  {loading && !counts ? <Skeleton className="h-3 w-7" /> : `(${counts?.get(value) ?? 0})`}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

function PriceFilter({ min, max, onApply }: { min?: number; max?: number; onApply: (min?: number, max?: number) => void }) {
  const [range, setRange] = useState<[number, number]>([min ?? 0.02, max ?? PRICE_CEIL])
  const fmt = (n: number) => n.toFixed(2).replace('.', ',')

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg leading-4 font-bold text-cream">Faixa de preço</legend>
      <div className="flex flex-col gap-3 pl-3">
        <Slider
          min={PRICE_FLOOR}
          max={PRICE_CEIL}
          step={0.01}
          value={range}
          onValueChange={(v) => setRange([v[0], v[1]])}
          minStepsBetweenThumbs={1}
          aria-label="Faixa de preço em ETH"
          thumbLabels={['Preço mínimo', 'Preço máximo']}
          className="h-5"
        />
        <p className="text-[15px] leading-5 text-cream" aria-live="polite">
          Preço: {fmt(range[0])} - {fmt(range[1])} ETH
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onApply(range[0] <= 0.02 ? undefined : range[0], range[1] >= PRICE_CEIL ? undefined : range[1])}
            className="h-9 rounded-md bg-brand px-3 text-base leading-5 font-bold text-ink hover:bg-brand-light"
          >
            Aplicar
          </button>
          {(min !== undefined || max !== undefined) && (
            <button type="button" onClick={() => onApply(undefined, undefined)} className="text-sm text-brand-light underline-offset-4 hover:underline">
              Limpar
            </button>
          )}
        </div>
      </div>
    </fieldset>
  )
}

export interface FiltersProps {
  search: CatalogSearch
  facets?: CatalogPage['facets']
  loading: boolean
  onChange: (patch: Partial<CatalogSearch>) => void
}

function toggleValue(list: string | undefined, value: string) {
  const values = list ? list.split(',') : []
  const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
  return next.length ? next.join(',') : undefined
}

export function CatalogFilters({ search, facets, loading, onChange, className }: FiltersProps & { className?: string }) {
  const collectionCounts = facets ? new Map(facets.collections.map((f) => [f.value, f.count])) : undefined
  const networkCounts = facets ? new Map(facets.networks.map((f) => [f.value, f.count])) : undefined
  const selectedCollections = search.collections?.split(',') ?? []
  const selectedNetworks = search.networks?.split(',') ?? []

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <FacetList<CollectionSlug>
        title="Coleções"
        values={COLLECTIONS}
        labels={COLLECTION_LABELS}
        selected={selectedCollections}
        counts={collectionCounts}
        boldCounts
        loading={loading}
        onToggle={(v) => onChange({ collections: toggleValue(search.collections, v) })}
      />
      <PriceFilter key={`${search.min}-${search.max}`} min={search.min} max={search.max} onApply={(min, max) => onChange({ min, max })} />
      <FacetList<Network>
        title="Rede"
        values={NETWORKS}
        labels={NETWORK_LABELS}
        selected={selectedNetworks}
        counts={networkCounts}
        boldCounts={false}
        loading={loading}
        onToggle={(v) => onChange({ networks: toggleValue(search.networks, v) })}
      />
    </div>
  )
}
