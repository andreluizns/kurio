import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { FavoritesResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { useSession } from '@/features/auth/session-store'

export function useFavorites() {
  const userId = useSession()?.user.id
  return useQuery({
    queryKey: queryKeys.favorites(userId ?? 'anonymous'),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
    enabled: !!userId,
  })
}

export function useIsFavorite(nftId: string) {
  const { data } = useFavorites()
  return data?.nftIds.includes(nftId) ?? false
}

/** Alterna favorito com atualização otimista e rollback em caso de falha. */
export function useToggleFavorite() {
  const qc = useQueryClient()
  const userId = useSession()?.user.id
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const key = queryKeys.favorites(userId ?? 'anonymous')

  const mutation = useMutation({
    mutationKey: ['favorites', 'toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoritesResponse>(key)
      qc.setQueryData<FavoritesResponse>(key, (current) => {
        const base = current ?? { nftIds: [], items: [] }
        return {
          nftIds: favorite ? [nftId, ...base.nftIds.filter((id) => id !== nftId)] : base.nftIds.filter((id) => id !== nftId),
          items: favorite ? base.items : base.items.filter((i) => i.id !== nftId),
        }
      })
      return { previous }
    },
    onError: (_error, vars, context) => {
      qc.setQueryData(key, context?.previous)
      toast.error(
        vars.favorite ? `Não foi possível favoritar ${vars.name}.` : `Não foi possível remover ${vars.name} dos favoritos.`,
        {
          id: `fav-error-${vars.nftId}`,
          description: 'O estado anterior foi restaurado.',
          duration: 12_000,
          action: { label: 'Tentar novamente', onClick: () => mutation.mutate(vars) },
        },
      )
    },
    onSuccess: (_data, vars) => {
      // Id próprio: o aviso de erro pode estar sendo fechado pela ação "Tentar novamente".
      toast.dismiss(`fav-error-${vars.nftId}`)
      toast.success(vars.favorite ? `${vars.name} adicionado à lista de interesse.` : `${vars.name} removido da lista de interesse.`, {
        id: `fav-success-${vars.nftId}`,
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  return {
    ...mutation,
    toggle(nftId: string, name: string, currentlyFavorite: boolean) {
      if (!userId) {
        toast.info('Entre na sua conta para salvar favoritos.')
        void navigate({ to: '/entrar', search: { redirect: href } })
        return
      }
      mutation.mutate({ nftId, favorite: !currentlyFavorite, name })
    },
  }
}
