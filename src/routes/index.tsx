import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@/features/catalog/HomePage'
import { catalogListOptions, highlightsOptions } from '@/features/catalog/queries'
import { toCatalogQuery, validateCatalogSearch } from '@/features/catalog/search-params'

export const Route = createFileRoute('/')({
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    // Pré-carrega sem bloquear a navegação: a página exibe skeletons enquanto isso.
    void context.queryClient.prefetchQuery(catalogListOptions(toCatalogQuery(deps)))
    void context.queryClient.prefetchQuery(highlightsOptions())
  },
  component: HomeRoute,
})

function HomeRoute() {
  const search = Route.useSearch()
  return <HomePage search={search} />
}
