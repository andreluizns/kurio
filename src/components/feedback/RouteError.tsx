import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { PageShell } from '@/components/layout/PageShell'
import { ErrorState } from './ErrorState'

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <PageShell>
      <ErrorState
        className="py-24"
        title="Algo deu errado ao carregar esta página"
        error={error}
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </PageShell>
  )
}
