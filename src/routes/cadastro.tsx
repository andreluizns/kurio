import { createFileRoute, redirect } from '@tanstack/react-router'
import { safeRedirect } from '@/app/router'
import { AuthPage } from '@/features/auth/AuthPage'
import { sessionStore } from '@/features/auth/session-store'

export const Route = createFileRoute('/cadastro')({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; motivo?: string } => ({
    redirect: typeof s.redirect === 'string' ? s.redirect : undefined,
    motivo: typeof s.motivo === 'string' ? s.motivo : undefined,
  }),
  // Usuário já autenticado volta direto ao destino.
  beforeLoad: ({ search }) => {
    if (sessionStore.token()) throw redirect({ href: safeRedirect(search.redirect), replace: true })
  },
  component: function AuthRoute() {
    const { redirect: target, motivo } = Route.useSearch()
    return <AuthPage mode="register" redirect={target} reason={motivo} />
  },
})
