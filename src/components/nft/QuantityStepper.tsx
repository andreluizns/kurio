import { cn } from '@/lib/utils'

function MinusGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M6 12h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function PlusGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M6 12h12M12 6v12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

const SIZES = {
  lg: { button: 'h-[50px] w-[33px] shadow-[0_6.6px_19.8px_rgb(20_13_10/0.15)]', glyph: 'size-[26px]', value: 'min-w-[13px] text-xl leading-7' },
  md: { button: 'h-[30px] w-5 shadow-soft', glyph: 'size-4', value: 'min-w-[11px] text-lg leading-[25px] font-medium' },
  sm: { button: 'size-6 rounded-full', glyph: 'size-4', value: 'min-w-6 text-base' },
}

/** Controle de quantidade inteira com limites (botões ±, estilo do layout). */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  size = 'lg',
  variant = 'solid',
  disabled = false,
}: {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  size?: keyof typeof SIZES
  variant?: 'solid' | 'muted'
  disabled?: boolean
}) {
  const s = SIZES[size]
  const button = cn(
    'flex shrink-0 items-center justify-center rounded-[33px] border border-ink transition-colors disabled:cursor-not-allowed disabled:opacity-40',
    variant === 'solid' ? 'bg-brand text-ink hover:bg-brand-light' : 'border-0 bg-cream/10 text-cream hover:bg-cream/20',
    s.button,
  )
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <button type="button" className={button} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Diminuir quantidade">
        <MinusGlyph className={s.glyph} />
      </button>
      <output aria-live="polite" aria-label={`Quantidade: ${value}`} className={cn('text-center text-cream', s.value)}>
        {value}
      </output>
      <button type="button" className={button} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Aumentar quantidade">
        <PlusGlyph className={s.glyph} />
      </button>
    </div>
  )
}
