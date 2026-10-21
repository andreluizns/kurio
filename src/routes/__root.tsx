import { lazy, Suspense, useEffect, useState } from 'react'
import { createRootRouteWithContext, Outlet, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isPrivatePath, type RouterContext } from '@/app/router'
import { mocksEnabled } from '@/app/env'
import { onSessionExpired } from '@/api/http'
import { Toaster } from '@/components/ui/sonner'
import { RealtimeProvider } from '@/features/realtime/RealtimeProvider'
import { sessionStore } from '@/features/auth/session-store'
import { clearPrivateCache, useSessionBootstrap } from '@/features/auth/use-auth'
import { useIsDesktop } from '@/lib/use-media-query'

const MockPanel = lazy(() => import('@/mocks/panel/MockPanel'))

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

/** Trata expiração da sessão durante a navegação e o checkout, preservando o contexto. */
function SessionExpiryWatcher() {
  const router = useRouter()
  const queryClient = useQueryClient()
  useSessionBootstrap()

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
        if (!sessionStore.get()) return
        sessionStore.set(null)
        clearPrivateCache(queryClient)
        const { pathname, href } = router.state.location
        const isPrivate = isPrivatePath(pathname)
        toast.warning('Sua sessão expirou.', {
          id: 'session-expired',
          description: isPrivate ? 'Entre novamente para continuar de onde parou.' : 'Entre novamente para acessar seus dados.',
        })
        if (isPrivate) {
          void router.navigate({ to: '/entrar', search: { redirect: href, motivo: 'expirada' } })
        }
      })
    return () => {
      unsubscribe()
    }
  }, [router, queryClient])
  return null
}

/** O painel de mocks é carregado quando o navegador fica ocioso (fora do caminho crítico). */
function useIdle() {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    const done = () => setIdle(true)
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(done, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(done, 2000)
    return () => clearTimeout(id)
  }, [])
  return idle
}

function RootLayout() {
  const isDesktop = useIsDesktop()
  const idle = useIdle()
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-ink"
      >
        Pular para o conteúdo
      </a>
      <SessionExpiryWatcher />
      <RealtimeProvider />
      <Outlet />
      <Toaster position={isDesktop ? 'bottom-right' : 'top-center'} closeButton richColors={false} />
      {idle && mocksEnabled && import.meta.env.VITE_MOCK_PANEL !== 'false' && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </>
  )
}
