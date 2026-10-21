import type {
  AddCartItemRequest,
  Cart,
  CatalogPage,
  CatalogQuery,
  CreateOrderRequest,
  FavoritesResponse,
  Highlights,
  LoginRequest,
  NftDetail,
  NftSummary,
  Order,
  PasswordChange,
  ProfileUpdate,
  Quote,
  QuoteRequest,
  RegisterRequest,
  Session,
  User,
  Wallet,
  WalletConnectRequest,
  WalletConnection,
  WalletInput,
  WalletSlot,
  WalletsResponse,
} from './contracts'
import { request } from './http'

type Opts = { signal?: AbortSignal }

function catalogParams(query: CatalogQuery) {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.collections?.length) params.set('collections', query.collections.join(','))
  if (query.networks?.length) params.set('networks', query.networks.join(','))
  if (query.minPrice) params.set('minPrice', query.minPrice)
  if (query.maxPrice) params.set('maxPrice', query.maxPrice)
  if (query.tab && query.tab !== 'todos') params.set('tab', query.tab)
  if (query.sort && query.sort !== 'recentes') params.set('sort', query.sort)
  params.set('page', String(query.page ?? 1))
  params.set('pageSize', String(query.pageSize ?? 9))
  return params
}

export const api = {
  catalog: {
    list: (query: CatalogQuery, { signal }: Opts = {}) =>
      request<CatalogPage>({ url: '/nfts', params: catalogParams(query), signal }),
    highlights: ({ signal }: Opts = {}) => request<Highlights>({ url: '/highlights', signal }),
    detail: (id: string, { signal }: Opts = {}) => request<NftDetail>({ url: `/nfts/${encodeURIComponent(id)}`, signal }),
    related: (id: string, { signal }: Opts = {}) =>
      request<NftSummary[]>({ url: `/nfts/${encodeURIComponent(id)}/related`, signal }),
    recommendations: ({ signal }: Opts = {}) => request<NftSummary[]>({ url: '/recommendations', signal }),
  },
  auth: {
    login: (body: LoginRequest) => request<Session>({ url: '/auth/login', method: 'POST', data: body }),
    register: (body: RegisterRequest) => request<Session>({ url: '/auth/register', method: 'POST', data: body }),
    session: ({ signal }: Opts = {}) => request<Session>({ url: '/auth/session', signal }),
    logout: () => request<void>({ url: '/auth/logout', method: 'POST' }),
  },
  profile: {
    get: ({ signal }: Opts = {}) => request<User>({ url: '/profile', signal }),
    update: (body: ProfileUpdate) => request<User>({ url: '/profile', method: 'PUT', data: body }),
    uploadAvatar: (file: File) => {
      const form = new FormData()
      form.append('avatar', file)
      return request<User>({ url: '/profile/avatar', method: 'POST', data: form })
    },
    removeAvatar: () => request<User>({ url: '/profile/avatar', method: 'DELETE' }),
    changePassword: (body: PasswordChange) => request<void>({ url: '/profile/password', method: 'POST', data: body }),
  },
  wallets: {
    list: ({ signal }: Opts = {}) => request<WalletsResponse>({ url: '/wallets', signal }),
    save: (slot: WalletSlot, body: WalletInput) => request<Wallet>({ url: `/wallets/${slot}`, method: 'PUT', data: body }),
    removeSecondary: () => request<void>({ url: '/wallets/secondary', method: 'DELETE' }),
    connect: (body: WalletConnectRequest) =>
      request<WalletConnection>({ url: '/wallet-connections', method: 'POST', data: body }),
    disconnect: (id: string) => request<void>({ url: `/wallet-connections/${id}`, method: 'DELETE' }),
  },
  favorites: {
    list: ({ signal }: Opts = {}) => request<FavoritesResponse>({ url: '/favorites', signal }),
    add: (nftId: string) => request<void>({ url: `/favorites/${encodeURIComponent(nftId)}`, method: 'PUT' }),
    remove: (nftId: string) => request<void>({ url: `/favorites/${encodeURIComponent(nftId)}`, method: 'DELETE' }),
  },
  cart: {
    get: ({ signal }: Opts = {}) => request<Cart>({ url: '/cart', signal }),
    addItem: (body: AddCartItemRequest) => request<Cart>({ url: '/cart/items', method: 'POST', data: body }),
    updateItem: (itemId: string, quantity: number) =>
      request<Cart>({ url: `/cart/items/${itemId}`, method: 'PATCH', data: { quantity } }),
    removeItem: (itemId: string) => request<Cart>({ url: `/cart/items/${itemId}`, method: 'DELETE' }),
    applyCoupon: (code: string) => request<Cart>({ url: '/cart/coupon', method: 'POST', data: { code } }),
    removeCoupon: () => request<Cart>({ url: '/cart/coupon', method: 'DELETE' }),
    acknowledge: () => request<Cart>({ url: '/cart/acknowledge', method: 'POST' }),
    merge: (guestCartId: string) => request<Cart>({ url: '/cart/merge', method: 'POST', data: { guestCartId } }),
  },
  checkout: {
    quote: (body: QuoteRequest) => request<Quote>({ url: '/quotes', method: 'POST', data: body }),
    createOrder: (body: CreateOrderRequest, idempotencyKey: string) =>
      request<Order>({ url: '/orders', method: 'POST', data: body, headers: { 'Idempotency-Key': idempotencyKey } }),
  },
  orders: {
    get: (id: string, { signal }: Opts = {}) => request<Order>({ url: `/orders/${encodeURIComponent(id)}`, signal }),
    list: (status?: Order['status'], { signal }: Opts = {}) =>
      request<Order[]>({ url: '/orders', params: status ? { status } : undefined, signal }),
  },
}
