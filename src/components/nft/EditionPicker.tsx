import type { NftEdition } from '@/api/contracts'
import { cn } from '@/lib/utils'

/** Seleção de edição (radiogroup); edições esgotadas ficam desabilitadas e riscadas. */
export function EditionPicker({
  editions,
  value,
  onChange,
  labelId,
}: {
  editions: NftEdition[]
  value: string
  onChange: (id: string) => void
  labelId: string
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap items-center gap-1.5 md:gap-1.5">
      {editions.map((edition) => {
        const selected = edition.id === value
        const soldOut = edition.available === 0
        return (
          <button
            key={edition.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={soldOut}
            disabled={soldOut}
            onClick={() => onChange(edition.id)}
            title={soldOut ? `Edição ${edition.label} esgotada` : `Edição ${edition.label}`}
            className={cn(
              'flex h-7 min-w-9 items-center justify-center rounded-[50%] border px-1.5 text-sm leading-4 transition-colors',
              selected ? 'border-brand font-medium text-brand-light' : 'border-line text-sand hover:border-brand/70',
              soldOut && 'cursor-not-allowed text-khaki/60 line-through hover:border-line',
            )}
          >
            {edition.label}
            {soldOut && <span className="sr-only"> (esgotada)</span>}
          </button>
        )
      })}
    </div>
  )
}
