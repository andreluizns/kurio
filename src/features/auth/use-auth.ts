import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest, Session } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { GUEST, queryKeys } from '@/api/query-keys'
import { resetEventMemory } from '@/features/realtime/apply-events'
import { guestCart, sessionStore, useSession } from './session-store'

/** Remove todo o cache privado (de qualquer usuário e do visitante). */
export function clearPrivateCache(qc: QueryClient) {
  qc.removeQueries({ queryKey: ['user'] })
  resetEventMemory()
}

async function establishSession(qc: QueryClient, session: Session) {
  const previous = sessionStore.get()
  if (previous && previous.user.id !== session.user.id) clearPrivateCache(qc)
  sessionStore.set(session)
  qc.removeQueries({ queryKey: ['user', GUEST] })

  // Preserva os itens adicionados como visitante.
  const guestId = guestCart.get()
  if (guestId) {
    try {
      const merged = await api.cart.merge(guestId)
      qc.setQueryData(queryKeys.cart(session.user.id), merged)
    } finally {
      guestCart.set(null)
    }
  }
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginRequest) => api.auth.login(body),
    onSuccess: (session) => establishSession(qc, session),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RegisterRequest) => api.auth.register(body),
    onSuccess: (session) => establishSession(qc, session),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout()
      } catch {
        // Mesmo sem resposta do servidor, a sessão local é encerrada.
      }
    },
    onSettled: () => {
      sessionStore.set(null)
      guestCart.set(null)
      clearPrivateCache(qc)
    },
  })
}

/** Valida a sessão persistida ao carregar a aplicação (recuperação após refresh). */
export function useSessionBootstrap() {
  const session = useSession()
  return useQuery({
    queryKey: [...queryKeys.session, session?.token ?? null],
    enabled: !!session,
    queryFn: async ({ signal }) => {
      const fresh = await api.auth.session({ signal })
      if (sessionStore.token() === fresh.token) sessionStore.set(fresh)
      return fresh
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useCurrentUser() {
  return useSession()?.user ?? null
}
