import type { QueryClient } from '@tanstack/react-query'
import type {
  Cart,
  CatalogPage,
  FavoritesResponse,
  NftDetail,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
} from '@/api/contracts'
import { queryKeys } from '@/api/query-keys'

/**
 * Aplicação idempotente dos eventos: ignora ids já vistos e versões menores ou iguais
 * à última versão conhecida do recurso, sem regredir estado mais recente.
 */
const MAX_SEEN = 500
const seen = new Set<string>()
const versions = new Map<string, number>()

export function resetEventMemory() {
  seen.clear()
  versions.clear()
}

function remember(id: string) {
  seen.add(id)
  if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value as string)
}

/** Registra a versão observada via REST, para descartar eventos mais antigos que ela. */
export function observeVersion(resourceKey: string, version: number) {
  const known = versions.get(resourceKey) ?? 0
  if (version > known) versions.set(resourceKey, version)
}

function shouldApply(event: { id: string; version: number }, resourceKey: string, cachedVersion?: number) {
  if (seen.has(event.id)) return false
  remember(event.id)
  const known = Math.max(versions.get(resourceKey) ?? 0, cachedVersion ?? 0)
  if (event.version <= known) return false
  versions.set(resourceKey, event.version)
  return true
}

function patchSummary<T extends NftSummary>(item: T, event: NftUpdatedEvent): T {
  if (item.id !== event.resource.id || item.version >= event.version) return item
  return {
    ...item,
    price: event.data.price,
    previousPrice: event.data.previousPrice,
    available: event.data.available,
    version: event.version,
  }
}

export type NftChangeOutcome = { applied: false } | { applied: true; inCart: Cart['items'] }

export function applyNftUpdated(qc: QueryClient, event: NftUpdatedEvent, owner: string): NftChangeOutcome {
  const id = event.resource.id
  const detail = qc.getQueryData<NftDetail>(queryKeys.catalog.detail(id))
  if (!shouldApply(event, `nft:${id}`, detail?.version)) return { applied: false }

  if (detail) {
    qc.setQueryData<NftDetail>(queryKeys.catalog.detail(id), {
      ...patchSummary(detail, event),
      editions: detail.editions.map((e) => {
        const next = event.data.editions.find((x) => x.id === e.id)
        return next ? { ...e, price: next.price, available: next.available } : e
      }),
    })
  }

  qc.setQueriesData<CatalogPage>({ queryKey: ['catalog', 'list'] }, (page) =>
    page ? { ...page, items: page.items.map((i) => patchSummary(i, event)) } : page,
  )
  for (const key of [['catalog', 'related'], queryKeys.catalog.recommendations]) {
    qc.setQueriesData<NftSummary[]>({ queryKey: key }, (list) => list?.map((i) => patchSummary(i, event)))
  }
  qc.setQueriesData<{ featured: NftSummary }>({ queryKey: queryKeys.catalog.highlights }, (h) =>
    h ? { ...h, featured: patchSummary(h.featured, event) } : h,
  )
  qc.setQueriesData<FavoritesResponse>({ queryKey: ['user'], predicate: (q) => q.queryKey[2] === 'favorites' }, (fav) =>
    fav ? { ...fav, items: fav.items.map((i) => patchSummary(i, event)) } : fav,
  )

  // O carrinho é recalculado pelo servidor (resumo, alterações e limites).
  const cart = qc.getQueryData<Cart>(queryKeys.cart(owner))
  const inCart = cart?.items.filter((i) => i.nftId === id) ?? []
  if (inCart.length) void qc.invalidateQueries({ queryKey: queryKeys.cart(owner) })
  return { applied: true, inCart }
}

export function applyOrderUpdated(qc: QueryClient, event: OrderUpdatedEvent, userId: string | null) {
  // Eventos de outra sessão/usuário nunca alteram dados locais.
  if (!userId || event.data.userId !== userId) return false
  const key = queryKeys.order(userId, event.resource.id)
  const cached = qc.getQueryData<Order>(key)
  if (!shouldApply(event, `order:${event.resource.id}`, cached?.version)) return false
  // Pedidos confirmados ou recusados são terminais.
  if (cached && cached.status !== 'pending') return false
  if (cached) {
    qc.setQueryData<Order>(key, {
      ...cached,
      status: event.data.status,
      transactionHash: event.data.transactionHash,
      explorerUrl: event.data.explorerUrl,
      declineReason: event.data.declineReason,
      version: event.version,
      updatedAt: event.occurredAt,
    })
  } else {
    void qc.invalidateQueries({ queryKey: key })
  }
  void qc.invalidateQueries({ queryKey: ['user', userId, 'orders'] })
  void qc.invalidateQueries({ queryKey: queryKeys.cart(userId) })
  return true
}
