import type {
  Cart,
  CartChange,
  CartItem,
  CatalogPage,
  CatalogQuery,
  CatalogSort,
  CatalogTab,
  Coupon,
  Network,
  NftDetail,
  NftSummary,
  PriceSummary,
  QuoteLine,
} from '@/api/contracts'
import { COLLECTIONS, NETWORKS } from '@/api/contracts'
import { add, compare, mul, percentOf, sub } from '@/lib/money'
import { db, nextId, type DbCart, type DbOrder } from './db'
import { isActive } from './scenarios'
import { NETWORK_FEES, SEED_COUPONS, SEED_NOW } from './seed'

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export function toSummary(nft: NftDetail): NftSummary {
  const { id, name, tokenId, artwork, collection, network, price, previousPrice, rarity, listedAt, available, defaultEditionId, version } = nft
  return { id, name, tokenId, artwork, collection, network, price, previousPrice, rarity, listedAt, available, defaultEditionId, version }
}

/** Recalcula campos derivados após mudanças em edições. */
export function refreshDerived(nft: NftDetail) {
  const def = nft.editions.find((e) => e.id === nft.defaultEditionId) ?? nft.editions[0]
  nft.price = def.price
  nft.available = nft.editions.reduce((acc, e) => acc + e.available, 0)
}

const NEW_WINDOW_MS = 10 * 24 * 3600_000

function matchesTab(nft: NftDetail, tab: CatalogTab) {
  if (tab === 'novos') return SEED_NOW - Date.parse(nft.listedAt) <= NEW_WINDOW_MS
  if (tab === 'em-alta') return nft.reviewsCount >= 25 || nft.rarity === 'raro'
  return true
}

function sortItems(items: NftDetail[], sort: CatalogSort) {
  const order = db().nftOrder
  const byInsertion = (a: NftDetail, b: NftDetail) => order.indexOf(a.id) - order.indexOf(b.id)
  const sorted = [...items]
  switch (sort) {
    case 'menor-preco':
      return sorted.sort((a, b) => compare(a.price, b.price) || byInsertion(a, b))
    case 'maior-preco':
      return sorted.sort((a, b) => compare(b.price, a.price) || byInsertion(a, b))
    case 'nome':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || byInsertion(a, b))
    default:
      return sorted.sort((a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt) || byInsertion(a, b))
  }
}

export function parseCatalogQuery(url: URL): Required<Omit<CatalogQuery, 'q' | 'minPrice' | 'maxPrice'>> &
  Pick<CatalogQuery, 'q' | 'minPrice' | 'maxPrice'> {
  const p = url.searchParams
  const list = <T extends string>(key: string, allowed: readonly T[]) =>
    p.getAll(key).flatMap((v) => v.split(',')).filter((v): v is T => (allowed as readonly string[]).includes(v))
  const page = Math.max(1, Number.parseInt(p.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(48, Math.max(1, Number.parseInt(p.get('pageSize') ?? '9', 10) || 9))
  const tab = (['todos', 'novos', 'em-alta'] as const).find((t) => t === p.get('tab')) ?? 'todos'
  const sort = (['recentes', 'menor-preco', 'maior-preco', 'nome'] as const).find((s) => s === p.get('sort')) ?? 'recentes'
  return {
    q: p.get('q')?.trim() || undefined,
    collections: list('collections', COLLECTIONS),
    networks: list('networks', NETWORKS),
    minPrice: p.get('minPrice') ?? undefined,
    maxPrice: p.get('maxPrice') ?? undefined,
    tab,
    sort,
    page,
    pageSize,
  }
}

export function queryCatalog(query: ReturnType<typeof parseCatalogQuery>): CatalogPage {
  const all = isActive('empty-catalog') ? [] : Object.values(db().nfts)
  const text = query.q?.toLocaleLowerCase('pt-BR')

  const base = all.filter((nft) => {
    if (!matchesTab(nft, query.tab)) return false
    if (text && !`${nft.name} ${nft.collectionName} ${nft.tokenId}`.toLocaleLowerCase('pt-BR').includes(text)) return false
    if (query.minPrice && compare(nft.price, query.minPrice) < 0) return false
    if (query.maxPrice && compare(nft.price, query.maxPrice) > 0) return false
    return true
  })
  const inCollections = (nft: NftDetail) => !query.collections.length || query.collections.includes(nft.collection)
  const inNetworks = (nft: NftDetail) => !query.networks.length || query.networks.includes(nft.network)

  const filtered = sortItems(base.filter((n) => inCollections(n) && inNetworks(n)), query.sort)
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const start = (query.page - 1) * query.pageSize

  // Facetas: cada contagem considera os demais filtros ativos, exceto o próprio grupo.
  const collectionFacet = COLLECTIONS.map((value) => ({
    value,
    count: base.filter((n) => n.collection === value && inNetworks(n)).length,
  }))
  const networkFacet = NETWORKS.map((value) => ({
    value,
    count: base.filter((n) => n.network === value && inCollections(n)).length,
  }))
  const prices = all.map((n) => n.price)
  const priceRange = prices.length
    ? {
        min: prices.reduce((a, b) => (compare(a, b) <= 0 ? a : b)),
        max: prices.reduce((a, b) => (compare(a, b) >= 0 ? a : b)),
      }
    : { min: '0', max: '0' }

  return {
    items: filtered.slice(start, start + query.pageSize).map(toSummary),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    facets: { collections: collectionFacet, networks: networkFacet, priceRange },
  }
}

// ---------------------------------------------------------------------------
// Cupons, carrinho e cotação
// ---------------------------------------------------------------------------

export type CouponCheck = { ok: true; coupon: Coupon } | { ok: false; code: 'COUPON_INVALID' | 'COUPON_EXPIRED'; message: string }

export function checkCoupon(code: string): CouponCheck {
  const normalized = code.trim().toUpperCase()
  const coupon = SEED_COUPONS.find((c) => c.code === normalized)
  if (!coupon) return { ok: false, code: 'COUPON_INVALID', message: 'Código promocional inválido.' }
  if (coupon.expiresAt <= Date.now()) {
    return { ok: false, code: 'COUPON_EXPIRED', message: 'Este código promocional expirou.' }
  }
  return { ok: true, coupon: { code: coupon.code, percentOff: coupon.percentOff, description: coupon.description } }
}

export function summarize(subtotal: string, coupon: Coupon | null, network: Network, hasItems: boolean): PriceSummary {
  const discount = coupon ? percentOf(subtotal, coupon.percentOff) : '0'
  const networkFee = hasItems ? NETWORK_FEES[network] : '0'
  return { subtotal, discount, networkFee, total: add(sub(subtotal, discount), networkFee) }
}

export function findCart(id: string) {
  return db().carts[id]
}

export function newCart(ownerId: string | null): DbCart {
  const cart: DbCart = { id: nextId('cart'), ownerId, lines: [], couponCode: null, version: 1, updatedAt: Date.now() }
  db().carts[cart.id] = cart
  return cart
}

export function cartForUser(userId: string): DbCart {
  return Object.values(db().carts).find((c) => c.ownerId === userId) ?? newCart(userId)
}

export function touch(cart: DbCart) {
  cart.version += 1
  cart.updatedAt = Date.now()
}

export function lineLimit(nft: NftDetail, editionId: string) {
  const edition = nft.editions.find((e) => e.id === editionId)
  return Math.min(edition?.available ?? 0, nft.maxPerOrder)
}

export function serializeCart(cart: DbCart): Cart {
  const changes: CartChange[] = []
  const items: CartItem[] = cart.lines.flatMap((line) => {
    const nft = db().nfts[line.nftId]
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) return []
    if (compare(edition.price, line.ackPrice) !== 0) {
      changes.push({ itemId: line.id, kind: 'price', from: line.ackPrice, to: edition.price })
    }
    if (edition.available < line.quantity) {
      changes.push({ itemId: line.id, kind: 'availability', from: String(line.quantity), to: String(edition.available) })
    }
    return [
      {
        id: line.id,
        nftId: nft.id,
        editionId: edition.id,
        name: nft.name,
        tokenId: nft.tokenId,
        artwork: nft.artwork,
        editionLabel: edition.label,
        quantity: line.quantity,
        unitPrice: edition.price,
        acknowledgedUnitPrice: line.ackPrice,
        lineTotal: mul(edition.price, line.quantity),
        available: edition.available,
        maxQuantity: lineLimit(nft, edition.id),
        nftVersion: nft.version,
      },
    ]
  })
  const subtotal = add('0', ...items.map((i) => i.lineTotal))
  const coupon = cart.couponCode ? checkCoupon(cart.couponCode) : null
  return {
    id: cart.id,
    ownerId: cart.ownerId,
    items,
    coupon: coupon?.ok ? coupon.coupon : null,
    summary: summarize(subtotal, coupon?.ok ? coupon.coupon : null, 'ethereum', items.length > 0),
    changes,
    version: cart.version,
    updatedAt: new Date(cart.updatedAt).toISOString(),
  }
}

export function quoteLines(cart: DbCart): QuoteLine[] {
  return serializeCart(cart).items.map((i) => ({
    itemId: i.id,
    nftId: i.nftId,
    editionId: i.editionId,
    name: i.name,
    tokenId: i.tokenId,
    artwork: i.artwork,
    editionLabel: i.editionLabel,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
  }))
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export function fakeTxHash(orderId: string) {
  let hex = ''
  let seed = 0
  for (const ch of orderId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  for (let i = 0; i < 64; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0
    hex += (seed >>> 16).toString(16).slice(-1)
  }
  return `0x${hex}`
}

export function explorerUrl(network: Network, hash: string) {
  const base =
    network === 'ethereum'
      ? 'https://sepolia.etherscan.io/tx/'
      : network === 'polygon'
        ? 'https://amoy.polygonscan.com/tx/'
        : 'https://explorer.solana.com/tx/'
  return `${base}${hash}${network === 'solana' ? '?cluster=devnet' : ''}`
}

/** Estado público do pedido (sem campos internos). */
export function publicOrder(order: DbOrder) {
  const { idempotencyKey: _k, requestHash: _h, cartId: _c, settleAt: _s, outcome: _o, ...rest } = order
  return rest
}
