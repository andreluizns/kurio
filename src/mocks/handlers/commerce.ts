import { delay, http, HttpResponse } from 'msw'
import type {
  AddCartItemRequest,
  Cart,
  CreateOrderRequest,
  Order,
  Quote,
  QuoteRequest,
  WalletConnectRequest,
  WalletConnection,
} from '@/api/contracts'
import { NETWORKS } from '@/api/contracts'
import { add, compare } from '@/lib/money'
import { db, nextId, persist, type DbCart, type DbOrder, type DbQuote } from '../db'
import {
  cartForUser,
  checkCoupon,
  explorerUrl,
  fakeTxHash,
  findCart,
  lineLimit,
  newCart,
  publicOrder,
  quoteLines,
  refreshDerived,
  serializeCart,
  summarize,
  touch,
} from '../domain'
import { API, apiError, ETH_ADDRESS_RE, networkConditions, optionalUser, readJson, requireUser } from '../http'
import { publishNftUpdated, publishOrderUpdated } from '../realtime'
import { getConfig, isActive, setConfig, type ScenarioId } from '../scenarios'

const QUOTE_TTL_MS = 5 * 60_000
const ORDER_TIMEOUT_DELAY_MS = 12_000

/** Carrinho do usuário autenticado ou do visitante (cabeçalho X-Cart-Id). */
function resolveCart(request: Request, { create = true } = {}): DbCart | null {
  const user = optionalUser(request)
  if (user) return cartForUser(user.id)
  const guestId = request.headers.get('x-cart-id')
  const guest = guestId ? findCart(guestId) : undefined
  if (guest && guest.ownerId === null) return guest
  return create ? newCart(null) : null
}

function cartResponse(cart: DbCart, status = 200, { save = true } = {}) {
  if (save) persist()
  return HttpResponse.json<Cart>(serializeCart(cart), { status })
}

function consumeScenario(id: ScenarioId) {
  setConfig({ scenarios: getConfig().scenarios.filter((s) => s !== id) })
}

function buildQuote(cart: DbCart, userId: string, network: Quote['network']): DbQuote {
  const lines = quoteLines(cart)
  const subtotal = add('0', ...lines.map((l) => l.lineTotal))
  const coupon = cart.couponCode ? checkCoupon(cart.couponCode) : null
  const now = Date.now()
  return {
    id: nextId('quote'),
    userId,
    cartId: cart.id,
    cartVersion: cart.version,
    network,
    coupon: coupon?.ok ? coupon.coupon : null,
    lines,
    ...summarize(subtotal, coupon?.ok ? coupon.coupon : null, network, lines.length > 0),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
  }
}

function publicQuote(quote: DbQuote): Quote {
  const { userId: _u, cartId: _c, ...rest } = quote
  return rest
}

/** Problemas que impedem a cotação: itens acima da disponibilidade. */
function availabilityProblems(cart: DbCart) {
  return serializeCart(cart).items.filter((i) => i.quantity > i.available || i.available === 0)
}

// ---------------------------------------------------------------------------
// Liquidação de pedidos
// ---------------------------------------------------------------------------

const timers = new Map<string, ReturnType<typeof setTimeout>>()

function adjustInventory(order: DbOrder, sign: 1 | -1) {
  const touched = new Set<string>()
  for (const line of order.lines) {
    const nft = db().nfts[line.nftId]
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) continue
    edition.available = Math.max(0, edition.available + sign * line.quantity)
    touched.add(nft.id)
  }
  for (const id of touched) {
    const nft = db().nfts[id]
    refreshDerived(nft)
    nft.version += 1
    publishNftUpdated(nft)
  }
}

export function settleOrder(order: DbOrder) {
  if (order.status !== 'pending') return
  timers.delete(order.id)
  const now = new Date().toISOString()
  if (order.outcome === 'confirmed') {
    order.status = 'confirmed'
    order.transactionHash = fakeTxHash(order.id)
    order.explorerUrl = explorerUrl(order.network, order.transactionHash)
    // Remove do carrinho apenas os itens e quantidades comprados.
    const cart = findCart(order.cartId)
    if (cart) {
      for (const line of order.lines) {
        const cartLine = cart.lines.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
        if (!cartLine) continue
        cartLine.quantity -= line.quantity
      }
      cart.lines = cart.lines.filter((l) => l.quantity > 0)
      if (!cart.lines.length) cart.couponCode = null
      touch(cart)
    }
  } else {
    order.status = 'declined'
    order.declineReason = 'O pagamento foi recusado pela carteira. Nenhum valor foi cobrado.'
    adjustInventory(order, 1)
  }
  order.version += 1
  order.updatedAt = now
  persist()
  publishOrderUpdated(order)
}

function schedule(order: DbOrder) {
  if (order.status !== 'pending' || timers.has(order.id)) return
  const wait = Math.max(0, order.settleAt - Date.now())
  timers.set(
    order.id,
    setTimeout(() => settleOrder(order), wait),
  )
}

/** Retoma timers de pedidos pendentes após recarregar a página (estado persistido). */
export function resumePendingOrders() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  for (const order of Object.values(db().orders)) {
    if (order.status !== 'pending') continue
    if (order.settleAt <= Date.now()) settleOrder(order)
    else schedule(order)
  }
}

export function settleAllNow() {
  for (const order of Object.values(db().orders)) {
    if (order.status === 'pending') settleOrder(order)
  }
}

function stableHash(value: unknown) {
  const json = JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
  let h = 2166136261
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 16777619) >>> 0
  return h.toString(16)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const commerceHandlers = [
  http.get(`${API}/cart`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'cart' })
    if (blocked) return blocked
    const before = Object.keys(db().carts).length
    const cart = resolveCart(request)!
    // Só persiste quando a consulta criou um carrinho novo (visitante).
    return cartResponse(cart, 200, { save: Object.keys(db().carts).length !== before })
  }),

  http.post(`${API}/cart/items`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'cart' })
    if (blocked) return blocked
    const cart = resolveCart(request)!
    const body = await readJson<AddCartItemRequest>(request)
    const nft = db().nfts[body.nftId]
    const edition = nft?.editions.find((e) => e.id === body.editionId)
    if (!nft || !edition) return apiError(404, 'NOT_FOUND', 'NFT ou edição não encontrados.')
    if (!Number.isInteger(body.quantity) || body.quantity < 1) {
      return apiError(422, 'VALIDATION_ERROR', 'Quantidade inválida.', { fields: { quantity: 'Informe uma quantidade inteira maior que zero.' } })
    }
    if (edition.available === 0) return apiError(409, 'EDITION_UNAVAILABLE', `A edição ${edition.label} está esgotada.`)
    const existing = cart.lines.find((l) => l.nftId === nft.id && l.editionId === edition.id)
    const limit = lineLimit(nft, edition.id)
    const desired = (existing?.quantity ?? 0) + body.quantity
    if (desired > limit) {
      return apiError(409, 'QUANTITY_LIMIT', `Você pode ter no máximo ${limit} unidade(s) desta edição no carrinho.`, {
        details: { limit, inCart: existing?.quantity ?? 0 },
      })
    }
    if (existing) {
      existing.quantity = desired
      existing.ackPrice = edition.price
    } else {
      cart.lines.push({ id: nextId('line'), nftId: nft.id, editionId: edition.id, quantity: body.quantity, ackPrice: edition.price, addedAt: Date.now() })
    }
    touch(cart)
    return cartResponse(cart, 201)
  }),

  http.patch(`${API}/cart/items/:itemId`, async ({ request, params }) => {
    const blocked = await networkConditions(request, { scope: 'cart' })
    if (blocked) return blocked
    const cart = resolveCart(request)!
    const line = cart.lines.find((l) => l.id === params.itemId)
    if (!line) return apiError(404, 'NOT_FOUND', 'Item não está mais no carrinho.')
    const body = await readJson<{ quantity: number }>(request)
    if (!Number.isInteger(body.quantity) || body.quantity < 1) {
      return apiError(422, 'VALIDATION_ERROR', 'Quantidade inválida.', { fields: { quantity: 'Informe uma quantidade inteira maior que zero.' } })
    }
    const nft = db().nfts[line.nftId]
    const limit = lineLimit(nft, line.editionId)
    if (body.quantity > limit) {
      return apiError(409, 'QUANTITY_LIMIT', limit === 0 ? 'Esta edição está esgotada.' : `Disponível: no máximo ${limit} unidade(s).`, {
        details: { limit },
      })
    }
    line.quantity = body.quantity
    touch(cart)
    return cartResponse(cart)
  }),

  http.delete(`${API}/cart/items/:itemId`, async ({ request, params }) => {
    const blocked = await networkConditions(request, { scope: 'cart' })
    if (blocked) return blocked
    const cart = resolveCart(request)!
    cart.lines = cart.lines.filter((l) => l.id !== params.itemId)
    if (!cart.lines.length) cart.couponCode = null
    touch(cart)
    return cartResponse(cart)
  }),

  http.post(`${API}/cart/coupon`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'cart' })
    if (blocked) return blocked
    const cart = resolveCart(request)!
    const body = await readJson<{ code: string }>(request)
    if (!String(body.code ?? '').trim()) {
      return apiError(422, 'VALIDATION_ERROR', 'Informe um código promocional.', { fields: { code: 'Informe um código promocional.' } })
    }
    if (!cart.lines.length) return apiError(422, 'VALIDATION_ERROR', 'Adicione NFTs ao carrinho antes de aplicar um cupom.')
    const result = checkCoupon(body.code)
    if (!result.ok) return apiError(422, result.code, result.message, { fields: { code: result.message } })
    cart.couponCode = result.coupon.code
    touch(cart)
    return cartResponse(cart)
  }),

  http.delete(`${API}/cart/coupon`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'cart' })
    if (blocked) return blocked
    const cart = resolveCart(request)!
    cart.couponCode = null
    touch(cart)
    return cartResponse(cart)
  }),

  /** Usuário reconhece as alterações de preço exibidas no carrinho. */
  http.post(`${API}/cart/acknowledge`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'cart' })
    if (blocked) return blocked
    const cart = resolveCart(request)!
    for (const line of cart.lines) {
      const edition = db().nfts[line.nftId]?.editions.find((e) => e.id === line.editionId)
      if (edition) line.ackPrice = edition.price
    }
    touch(cart)
    return cartResponse(cart)
  }),

  /** Mescla o carrinho do visitante no carrinho do usuário ao autenticar. */
  http.post(`${API}/cart/merge`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'cart' })
    if (blocked) return blocked
    const user = requireUser(request)
    const body = await readJson<{ guestCartId: string }>(request)
    const target = cartForUser(user.id)
    const guest = findCart(body.guestCartId)
    if (guest && guest.ownerId === null && guest.id !== target.id) {
      for (const line of guest.lines) {
        const nft = db().nfts[line.nftId]
        if (!nft) continue
        const limit = lineLimit(nft, line.editionId)
        const existing = target.lines.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
        if (existing) existing.quantity = Math.min(limit, existing.quantity + line.quantity) || existing.quantity
        else target.lines.push({ ...line, id: nextId('line'), quantity: Math.max(1, Math.min(limit, line.quantity)) })
      }
      if (!target.couponCode && guest.couponCode) target.couponCode = guest.couponCode
      delete db().carts[guest.id]
      touch(target)
    }
    return cartResponse(target)
  }),

  http.post(`${API}/quotes`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'checkout' })
    if (blocked) return blocked
    const user = requireUser(request)
    const body = await readJson<QuoteRequest>(request)
    if (!NETWORKS.includes(body.network)) {
      return apiError(422, 'VALIDATION_ERROR', 'Selecione uma rede.', { fields: { network: 'Selecione uma rede.' } })
    }
    const cart = cartForUser(user.id)
    if (!cart.lines.length) return apiError(422, 'VALIDATION_ERROR', 'Seu carrinho está vazio.')
    const problems = availabilityProblems(cart)
    if (problems.length) {
      return apiError(409, 'AVAILABILITY_CONFLICT', 'Alguns itens não têm disponibilidade suficiente.', {
        details: { items: problems.map((p) => ({ itemId: p.id, available: p.available })) },
      })
    }
    if (cart.couponCode) {
      const coupon = checkCoupon(cart.couponCode)
      if (!coupon.ok) {
        cart.couponCode = null
        touch(cart)
        persist()
        return apiError(422, coupon.code, coupon.message)
      }
    }
    const quote = buildQuote(cart, user.id, body.network)
    db().quotes[quote.id] = quote
    persist()
    return HttpResponse.json<Quote>(publicQuote(quote), { status: 201 })
  }),

  http.post(`${API}/wallet-connections`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'checkout' })
    if (blocked) return blocked
    const user = requireUser(request)
    const body = await readJson<WalletConnectRequest>(request)
    if (!ETH_ADDRESS_RE.test(body.address ?? '') || !NETWORKS.includes(body.network)) {
      return apiError(422, 'VALIDATION_ERROR', 'Carteira ou rede inválida.')
    }
    await delay(600)
    if (isActive('wallet-rejected')) {
      return apiError(409, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    }
    const connection = {
      id: nextId('conn'),
      userId: user.id,
      provider: body.provider,
      network: body.network,
      address: body.address,
      connectedAt: new Date().toISOString(),
      active: true,
    }
    db().walletConnections[connection.id] = connection
    persist()
    const { userId: _u, active: _a, ...publicConnection } = connection
    return HttpResponse.json<WalletConnection>(publicConnection, { status: 201 })
  }),

  http.delete(`${API}/wallet-connections/:id`, async ({ request, params }) => {
    const blocked = await networkConditions(request, { scope: 'checkout' })
    if (blocked) return blocked
    const user = requireUser(request)
    const connection = db().walletConnections[String(params.id)]
    if (connection && connection.userId === user.id) connection.active = false
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API}/orders`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'checkout' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    const key = request.headers.get('idempotency-key')
    if (!key) return apiError(400, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key obrigatório.')
    const body = await readJson<CreateOrderRequest>(request)
    const hash = stableHash(body)
    const d = db()

    // Mesma tentativa: devolve o mesmo pedido; conteúdo diferente: conflito.
    const previous = d.idempotency[key]
    if (previous) {
      if (previous.userId !== user.id || previous.hash !== hash) {
        return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
      }
      return HttpResponse.json<Order>(publicOrder(d.orders[previous.orderId]), { status: 200 })
    }

    const connection = d.walletConnections[body.walletConnectionId]
    if (isActive('wallet-disconnect') && connection) {
      connection.active = false
      consumeScenario('wallet-disconnect')
    }
    if (!connection || !connection.active || connection.userId !== user.id) {
      persist()
      return apiError(409, 'WALLET_NOT_CONNECTED', 'Sua carteira foi desconectada. Conecte novamente para continuar.')
    }

    const quote = d.quotes[body.quoteId]
    if (!quote || quote.userId !== user.id) return apiError(404, 'NOT_FOUND', 'Cotação não encontrada.')
    if (Date.parse(quote.expiresAt) <= Date.now()) {
      return apiError(409, 'QUOTE_EXPIRED', 'A cotação expirou. Revise os valores atualizados.')
    }

    // Cenários de mudança no momento da confirmação (aplicados uma única vez).
    const first = quote.lines[0]
    if (first && (isActive('price-change-on-checkout') || isActive('sold-out-on-checkout'))) {
      const nft = d.nfts[first.nftId]
      const edition = nft.editions.find((e) => e.id === first.editionId)!
      if (isActive('price-change-on-checkout')) {
        edition.price = add(edition.price, '0.1')
        consumeScenario('price-change-on-checkout')
      } else {
        edition.available = 0
        consumeScenario('sold-out-on-checkout')
      }
      refreshDerived(nft)
      nft.version += 1
      publishNftUpdated(nft)
    }

    // Revalidação de preço, disponibilidade, cupom e versão do carrinho.
    const cart = cartForUser(user.id)
    const availability = availabilityProblems(cart)
    if (availability.length) {
      persist()
      return apiError(409, 'AVAILABILITY_CONFLICT', 'Um ou mais itens esgotaram ou têm disponibilidade menor.', {
        details: { items: availability.map((p) => ({ itemId: p.id, available: p.available })) },
      })
    }
    const fresh = buildQuote(cart, user.id, quote.network)
    const couponChanged = (fresh.coupon?.code ?? null) !== (quote.coupon?.code ?? null)
    const changed =
      cart.version !== quote.cartVersion ||
      couponChanged ||
      compare(fresh.total, quote.total) !== 0 ||
      fresh.lines.length !== quote.lines.length
    if (changed) {
      d.quotes[fresh.id] = fresh
      persist()
      return apiError(409, 'QUOTE_CHANGED', 'Os valores mudaram desde a sua revisão. Confirme a nova cotação.', {
        details: { quote: publicQuote(fresh), previousTotal: quote.total },
      })
    }

    const now = Date.now()
    const order: DbOrder = {
      id: nextId('ord'),
      userId: user.id,
      status: 'pending',
      lines: structuredClone(quote.lines),
      subtotal: quote.subtotal,
      discount: quote.discount,
      networkFee: quote.networkFee,
      total: quote.total,
      coupon: quote.coupon,
      network: body.network,
      provider: body.provider,
      walletAddress: body.walletAddress,
      transactionHash: null,
      explorerUrl: null,
      declineReason: null,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      version: 1,
      idempotencyKey: key,
      requestHash: hash,
      cartId: cart.id,
      settleAt: now + getConfig().settleDelayMs,
      outcome: isActive('payment-declined') ? 'declined' : 'confirmed',
    }
    d.orders[order.id] = order
    d.idempotency[key] = { userId: user.id, hash, orderId: order.id }
    delete d.quotes[quote.id]
    // Reserva o estoque enquanto o pagamento está pendente.
    adjustInventory(order, -1)
    persist()
    schedule(order)

    if (isActive('order-timeout')) {
      consumeScenario('order-timeout')
      await delay(ORDER_TIMEOUT_DELAY_MS)
    }
    return HttpResponse.json<Order>(publicOrder(order), { status: 201 })
  }),

  http.get(`${API}/orders`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'orders' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    const status = new URL(request.url).searchParams.get('status')
    const orders = Object.values(db().orders)
      .filter((o) => o.userId === user.id && (!status || o.status === status))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(publicOrder)
    return HttpResponse.json<Order[]>(orders)
  }),

  http.get(`${API}/orders/:id`, async ({ request, params }) => {
    const blocked = await networkConditions(request, { scope: 'orders' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    const order = db().orders[String(params.id)]
    // Pedidos de outro usuário são tratados como inexistentes (sem vazar existência).
    if (!order || order.userId !== user.id) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
    if (order.status === 'pending' && order.settleAt <= Date.now()) settleOrder(order)
    return HttpResponse.json<Order>(publicOrder(order))
  }),
]

