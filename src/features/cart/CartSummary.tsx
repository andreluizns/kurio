import { useId, useState } from 'react'
import type { Cart, PriceSummary } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDiscount, formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useCoupon } from './use-cart'

export function SummaryRows({ summary, variant = 'desktop', showTotal = true }: { summary: PriceSummary; variant?: 'desktop' | 'mobile' | 'compact'; showTotal?: boolean }) {
  const value = variant === 'desktop' ? 'text-lg leading-4' : 'text-base leading-4'
  return (
    <dl className="flex flex-col gap-3 text-[15px] leading-5 text-cream" data-testid="price-summary">
      <div className="flex items-center justify-between">
        <dt>Subtotal</dt>
        <dd className={value} data-testid="summary-subtotal">
          {formatEth(summary.subtotal)}
        </dd>
      </div>
      <div className="flex items-center justify-between">
        <dt>Desconto do lançamento</dt>
        <dd data-testid="summary-discount">{formatDiscount(summary.discount)}</dd>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex w-full items-center justify-between">
          <dt>Taxa de rede</dt>
          <dd className={value} data-testid="summary-fee">
            {formatEth(summary.networkFee)}
          </dd>
        </div>
        <span className="text-xs leading-4 text-brand-light">Taxa estimada</span>
      </div>
      {showTotal && (
        <div className={cn('flex items-center justify-between', variant === 'desktop' ? 'mt-3' : 'mt-1')}>
          <dt className="text-base leading-4 font-bold">Total</dt>
          <dd className={cn('font-bold text-brand-light', variant === 'mobile' ? 'text-lg' : 'text-lg leading-4')} data-testid="summary-total">
            {formatEth(summary.total)}
          </dd>
        </div>
      )}
    </dl>
  )
}

export function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando resumo">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  )
}

/** Campo de cupom: aplica/remove via API e exibe erros de código inválido ou expirado. */
export function CouponField({ cart, variant = 'desktop' }: { cart: Cart; variant?: 'desktop' | 'mobile' }) {
  const id = useId()
  const [code, setCode] = useState('')
  const { apply, remove } = useCoupon()
  const error = apply.error && isApiError(apply.error) ? apply.error.fields.code ?? apply.error.message : apply.error?.message

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[3px] border border-line px-3 py-2" role="status">
        <p className="text-sm text-cream">
          Cupom <strong className="text-brand-light">{cart.coupon.code}</strong> aplicado — {cart.coupon.percentOff}% off
        </p>
        <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="text-sm text-brand-light underline-offset-4 hover:underline">
          Remover
        </button>
      </div>
    )
  }

  const mobile = variant === 'mobile'
  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        apply.mutate(code.trim(), { onSuccess: () => setCode('') })
      }}
    >
      {!mobile && (
        <label htmlFor={id} className="text-sm leading-4 font-bold text-cream">
          Código promocional
        </label>
      )}
      <div
        className={cn(
          'flex items-center border',
          mobile ? 'h-[50px] rounded-[40px] border-line bg-surface pl-4 shadow-lift' : 'h-10 rounded-[3px] border-brand pl-2',
          error && 'border-coral',
        )}
      >
        {mobile && (
          <label htmlFor={id} className="sr-only">
            Código promocional
          </label>
        )}
        <input
          id={id}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            if (apply.error) apply.reset()
          }}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn('h-full min-w-0 flex-1 bg-transparent text-cream placeholder:text-khaki focus:outline-none', mobile ? 'text-[13px]' : 'text-xs')}
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className={cn(
            'h-full shrink-0 text-[15px] leading-4 font-bold disabled:opacity-60',
            mobile ? 'w-[97px] rounded-[40px] bg-[linear-gradient(90deg,rgb(210_138_76/0.54),#d28a4c)] text-cream' : 'w-[102px] rounded-r-[3px] bg-brand text-ink',
          )}
        >
          {apply.isPending ? '…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}
    </form>
  )
}
