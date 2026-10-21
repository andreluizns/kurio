import type { QueryClient } from '@tanstack/react-query'
import { createRouter, redirect, type ParsedLocation } from '@tanstack/react-router'
import { sessionStore } from '@/features/auth/session-store'
import { routeTree } from '@/routeTree.gen'
import { NotFound } from '@/components/feedback/NotFound'
import { RouteError } from '@/components/feedback/RouteError'

export interface RouterContext {
  queryClient: QueryClient
}

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    // Dados ficam no TanStack Query; o loader do router apenas pré-carrega.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultNotFoundComponent: () => <NotFound />,
    defaultErrorComponent: RouteError,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}

/** Guarda de rotas privadas: redireciona ao login preservando o destino. */
export function requireAuth({ location }: { location: ParsedLocation }) {
  if (!sessionStore.token()) {
    throw redirect({ to: '/entrar', search: { redirect: location.href } })
  }
}

/** Aceita apenas caminhos internos como destino de retorno (evita open redirect). */
export function safeRedirect(target: unknown, fallback = '/') {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : fallback
}

/** Rotas que exigem sessão (guardadas por `requireAuth`). */
export const PRIVATE_PATHS = ['/pagamento', '/pedido', '/conta']

export const isPrivatePath = (path: string) => PRIVATE_PATHS.some((p) => path.startsWith(p))

/**
 * Destino ao sair do login sem autenticar (voltar no mobile, fechar o modal no desktop).
 * Nunca volta para uma rota privada — o guarda devolveria ao login, criando um ciclo.
 */
export function authExitTarget(redirect: unknown) {
  const target = safeRedirect(redirect)
  if (target.startsWith('/pagamento')) return '/carrinho'
  return isPrivatePath(target) ? '/' : target
}
