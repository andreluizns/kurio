import { ArrowRight2 } from '@/components/icons'
import { cn } from '@/lib/utils'

/** Janela de até 4 páginas + anterior/próxima, no estilo do layout. */
export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  const size = Math.min(4, totalPages)
  const start = Math.min(Math.max(1, page - 1), totalPages - size + 1)
  const pages = Array.from({ length: size }, (_, i) => start + i)
  const cell = 'flex size-[35px] items-center justify-center rounded border border-line text-lg leading-4 text-cream transition-colors hover:border-brand disabled:pointer-events-none disabled:opacity-40'

  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end">
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <button type="button" className={cell} onClick={() => onChange(page - 1)} aria-label="Página anterior">
              <ArrowRight2 className="size-[18px] rotate-180" />
            </button>
          </li>
        )}
        {pages.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              className={cn(cell, p === page && 'border-brand bg-brand font-bold text-ink')}
            >
              {p}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={cell} onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Próxima página">
            <ArrowRight2 className="size-[18px]" />
          </button>
        </li>
      </ul>
      <p className="sr-only" aria-live="polite">
        Página {page} de {totalPages}
      </p>
    </nav>
  )
}
