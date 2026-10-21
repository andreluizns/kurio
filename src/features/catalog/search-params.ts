import {
  COLLECTIONS,
  NETWORKS,
  type CatalogQuery,
  type CatalogSort,
  type CatalogTab,
  type CollectionSlug,
  type Network,
} from '@/api/contracts'

/** Estado do catálogo na URL. Listas usam valores separados por vírgula. */
export interface CatalogSearch {
  q?: string
  collections?: string
  networks?: string
  min?: number
  max?: number
  tab?: CatalogTab
  sort?: CatalogSort
  page?: number
}

const TABS: CatalogTab[] = ['todos', 'novos', 'em-alta']
const SORTS: CatalogSort[] = ['recentes', 'menor-preco', 'maior-preco', 'nome']

export const SORT_LABELS: Record<CatalogSort, string> = {
  recentes: 'Listados recentemente',
  'menor-preco': 'Menor preço',
  'maior-preco': 'Maior preço',
  nome: 'Nome (A–Z)',
}

export const TAB_LABELS: Record<CatalogTab, string> = {
  todos: 'Todos os NFTs',
  novos: 'Novos lançamentos',
  'em-alta': 'Em alta',
}

export const COLLECTION_LABELS: Record<CollectionSlug, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

function parseList<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  if (typeof raw !== 'string' && !Array.isArray(raw)) return []
  const values = (Array.isArray(raw) ? raw.map(String) : raw.split(',')).map((v) => v.trim())
  return allowed.filter((a) => values.includes(a))
}

function parsePrice(raw: unknown) {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.replace(',', '.')) : NaN
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined
}

/** Normaliza parâmetros vindos da URL (valores inválidos são descartados). */
export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const collections = parseList(raw.collections, COLLECTIONS)
  const networks = parseList(raw.networks, NETWORKS)
  const page = Number(raw.page)
  const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, 80) : typeof raw.q === 'number' ? String(raw.q) : ''
  const min = parsePrice(raw.min)
  const max = parsePrice(raw.max)
  return {
    q: q || undefined,
    collections: collections.length ? collections.join(',') : undefined,
    networks: networks.length ? networks.join(',') : undefined,
    min,
    max: max !== undefined && min !== undefined && max < min ? undefined : max,
    tab: TABS.includes(raw.tab as CatalogTab) && raw.tab !== 'todos' ? (raw.tab as CatalogTab) : undefined,
    sort: SORTS.includes(raw.sort as CatalogSort) && raw.sort !== 'recentes' ? (raw.sort as CatalogSort) : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

export const CATALOG_PAGE_SIZE = 9

export function toCatalogQuery(search: CatalogSearch): CatalogQuery {
  return {
    q: search.q,
    collections: parseList(search.collections, COLLECTIONS),
    networks: parseList(search.networks, NETWORKS),
    minPrice: search.min !== undefined ? String(search.min) : undefined,
    maxPrice: search.max !== undefined ? String(search.max) : undefined,
    tab: search.tab ?? 'todos',
    sort: search.sort ?? 'recentes',
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

export function toggleInList(list: string | undefined, value: string) {
  const values = list ? list.split(',') : []
  const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
  return next.length ? next.join(',') : undefined
}
