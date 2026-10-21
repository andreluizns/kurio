import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { CatalogQuery } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { observeVersion } from '@/features/realtime/apply-events'

export const catalogListOptions = (query: CatalogQuery) =>
  queryOptions({
    queryKey: queryKeys.catalog.list(query),
    queryFn: async ({ signal }) => {
      const page = await api.catalog.list(query, { signal })
      for (const item of page.items) observeVersion(`nft:${item.id}`, item.version)
      return page
    },
    // Mantém a página anterior visível durante a troca de filtros (atualização em segundo plano).
    placeholderData: keepPreviousData,
  })

export const highlightsOptions = () =>
  queryOptions({
    queryKey: queryKeys.catalog.highlights,
    queryFn: ({ signal }) => api.catalog.highlights({ signal }),
    staleTime: 5 * 60_000,
  })

export const nftDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.catalog.detail(id),
    queryFn: async ({ signal }) => {
      const nft = await api.catalog.detail(id, { signal })
      observeVersion(`nft:${nft.id}`, nft.version)
      return nft
    },
  })

export const relatedOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.catalog.related(id),
    queryFn: ({ signal }) => api.catalog.related(id, { signal }),
  })

export const recommendationsOptions = () =>
  queryOptions({
    queryKey: queryKeys.catalog.recommendations,
    queryFn: ({ signal }) => api.catalog.recommendations({ signal }),
  })

export const useCatalog = (query: CatalogQuery) => useQuery(catalogListOptions(query))
export const useHighlights = () => useQuery(highlightsOptions())
export const useNftDetail = (id: string) => useQuery(nftDetailOptions(id))
export const useRelated = (id: string) => useQuery(relatedOptions(id))
export const useRecommendations = () => useQuery(recommendationsOptions())
