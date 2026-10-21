import { errorMessage } from '@/lib/error-message'
import { Danger } from '@/components/icons'
import { cn } from '@/lib/utils'

export function ErrorState({
  title = 'Não foi possível carregar',
  error,
  onRetry,
  retrying = false,
  className,
}: {
  title?: string
  error?: unknown
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-md border border-line bg-surface/60 px-6 py-10 text-center', className)}>
      <Danger className="size-6 text-coral" />
      <h2 className="text-base font-bold text-cream">{title}</h2>
      <p className="max-w-md text-sm leading-6 text-sand">{errorMessage(error)}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-1 rounded-md bg-brand px-5 py-2 text-sm font-bold text-ink hover:bg-brand-light disabled:opacity-60"
        >
          {retrying ? 'Tentando…' : 'Tentar novamente'}
        </button>
      )}
    </div>
  )
}
