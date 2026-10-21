import { useNavigate } from '@tanstack/react-router'
import type { CatalogSearch } from './search-params'

export function useCatalogNavigation(search: CatalogSearch) {
  const navigate = useNavigate()
  return (patch: Partial<CatalogSearch>, { resetPage = true }: { resetPage?: boolean } = {}) => {
    void navigate({
      to: '/',
      // Mudança de filtro reinicia a paginação; cada alteração entra no histórico.
      search: { ...search, ...patch, ...(resetPage ? { page: undefined } : {}) },
      resetScroll: false,
    })
  }
}
