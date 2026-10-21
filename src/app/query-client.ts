import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/http'

/**
 * Política de cache (documentada em ARCHITECTURE.md):
 * - Consultas: staleTime de 30 s; até 2 novas tentativas apenas para falhas transitórias
 *   (rede, timeout, 5xx), com backoff exponencial. Erros 4xx não são repetidos.
 * - Mutations: nunca repetidas automaticamente (evita duplicar operações); pedidos usam
 *   chave de idempotência e são reenviados explicitamente pelo fluxo de checkout.
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => isApiError(error) && error.isTransient && failureCount < 2,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
      },
      mutations: { retry: false },
    },
  })
}
