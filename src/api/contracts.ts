/**
 * Contratos REST e de eventos compartilhados entre o cliente, os handlers MSW e os testes.
 * Valores monetários em ETH trafegam sempre como strings decimais (ex.: "1.19").
 * Quantidades são inteiros.
 */

export type Eth = string
export type IsoDate = string

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'AVAILABILITY_CONFLICT'
  | 'EDITION_UNAVAILABLE'
  | 'QUANTITY_LIMIT'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'QUOTE_CHANGED'
  | 'QUOTE_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'WALLET_REJECTED'
  | 'WALLET_NOT_CONNECTED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Erros por campo, chaveados pelo nome do campo enviado. */
    fields?: Record<string, string>
    /** Dados extras específicos do código (ex.: nova cotação em QUOTE_CHANGED). */
    details?: unknown
  }
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export type Network = 'ethereum' | 'polygon' | 'solana'
export const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']

export type CollectionSlug =
  | 'arte-digital'
  | 'fotografia'
  | 'musica'
  | 'arte-3d'
  | 'colecionaveis'
  | 'generativa'
  | 'jogos'
  | 'assinaturas'
  | 'utilidade'

export const COLLECTIONS: CollectionSlug[] = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
]

export type CatalogTab = 'todos' | 'novos' | 'em-alta'
export type CatalogSort = 'recentes' | 'menor-preco' | 'maior-preco' | 'nome'

export type ArtworkKey = 'emerald' | 'nomad' | 'baron' | 'golden'

export interface NftEdition {
  id: string
  /** Rótulo exibido: "1/1", "1/10", "1/50" ou "ABERTA". */
  label: string
  price: Eth
  /** Unidades ainda disponíveis para compra. 0 = edição esgotada. */
  available: number
  /** Tamanho total da edição; null para edição aberta. */
  supply: number | null
}

export interface NftSummary {
  id: string
  name: string
  tokenId: string
  artwork: ArtworkKey
  collection: CollectionSlug
  network: Network
  /** Preço da edição padrão. */
  price: Eth
  /** Preço anterior, exibido riscado quando houve redução. */
  previousPrice: Eth | null
  rarity: 'raro' | null
  listedAt: IsoDate
  /** Total de unidades disponíveis somando todas as edições. */
  available: number
  /** Edição usada no preço exibido e na adição rápida ao carrinho. */
  defaultEditionId: string
  /** Versão do recurso, incrementada a cada alteração (compartilhada com os eventos). */
  version: number
}

export interface NftReview {
  id: string
  author: string
  rating: number
  date: IsoDate
  text: string
}

export interface NftDetail extends NftSummary {
  description: string
  story: string[]
  collectionName: string
  attributes: string[]
  rating: number
  reviewsCount: number
  /** Amostra das avaliações mais recentes. */
  reviews: NftReview[]
  contract: string
  royaltiesPercent: number
  editions: NftEdition[]
  /** Limite por pedido, independente da disponibilidade. */
  maxPerOrder: number
}

export interface CatalogQuery {
  q?: string
  collections?: CollectionSlug[]
  networks?: Network[]
  minPrice?: string
  maxPrice?: string
  tab?: CatalogTab
  sort?: CatalogSort
  page?: number
  pageSize?: number
}

export interface FacetCount<T extends string> {
  value: T
  count: number
}

export interface CatalogPage {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    collections: FacetCount<CollectionSlug>[]
    networks: FacetCount<Network>[]
    priceRange: { min: Eth; max: Eth }
  }
}

export interface HeroSlide {
  id: string
  eyebrow: string
  title: string
  description: string
  nftId: string
  artwork: ArtworkKey
}

export interface Highlights {
  slides: HeroSlide[]
  featured: NftSummary
}

// ---------------------------------------------------------------------------
// Sessão e conta
// ---------------------------------------------------------------------------

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  ensName: string
  ensSuffix: '.eth' | '.kurio.eth'
  walletNickname: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  user: User
  expiresAt: IsoDate
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface ProfileUpdate {
  displayName: string
  username: string
  email: string
  ensName: string
  ensSuffix: User['ensSuffix']
  walletNickname: string
}

export interface PasswordChange {
  currentPassword: string
  newPassword: string
}

// ---------------------------------------------------------------------------
// Carteiras
// ---------------------------------------------------------------------------

export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase'
export type WalletSlot = 'primary' | 'secondary'

export interface Wallet {
  slot: WalletSlot
  displayName: string
  nickname: string
  network: Network
  profileName: string
  address: string
  secondaryAddress: string
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
  ensSuffix: User['ensSuffix']
  updatedAt: IsoDate
}

export type WalletInput = Omit<Wallet, 'slot' | 'updatedAt'>

export interface WalletsResponse {
  primary: Wallet | null
  secondary: Wallet | null
}

export interface WalletConnectRequest {
  provider: WalletProvider
  network: Network
  address: string
}

export interface WalletConnection {
  id: string
  provider: WalletProvider
  network: Network
  address: string
  connectedAt: IsoDate
}

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------

export interface FavoritesResponse {
  nftIds: string[]
  items: NftSummary[]
}

// ---------------------------------------------------------------------------
// Carrinho e cotação
// ---------------------------------------------------------------------------

export interface CartItem {
  id: string
  nftId: string
  editionId: string
  name: string
  tokenId: string
  artwork: ArtworkKey
  editionLabel: string
  quantity: number
  unitPrice: Eth
  /** Preço unitário quando o item foi adicionado/confirmado pela última vez. */
  acknowledgedUnitPrice: Eth
  lineTotal: Eth
  available: number
  maxQuantity: number
  /** Versão do NFT refletida nesta linha. */
  nftVersion: number
}

export interface Coupon {
  code: string
  percentOff: number
  description: string
}

export interface PriceSummary {
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
}

export interface Cart {
  id: string
  ownerId: string | null
  items: CartItem[]
  coupon: Coupon | null
  summary: PriceSummary
  /** Itens cujo preço ou disponibilidade mudou desde a última confirmação do usuário. */
  changes: CartChange[]
  version: number
  updatedAt: IsoDate
}

export interface CartChange {
  itemId: string
  kind: 'price' | 'availability'
  from: string
  to: string
}

export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}

export interface QuoteLine {
  itemId: string
  nftId: string
  editionId: string
  name: string
  tokenId: string
  artwork: ArtworkKey
  editionLabel: string
  quantity: number
  unitPrice: Eth
  lineTotal: Eth
}

export interface Quote extends PriceSummary {
  id: string
  cartVersion: number
  network: Network
  coupon: Coupon | null
  lines: QuoteLine[]
  expiresAt: IsoDate
  createdAt: IsoDate
}

export interface QuoteRequest {
  network: Network
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface BuyerDetails {
  displayName: string
  username: string
  profileName: string
  email: string
  referralCode: string
  ensName: string
  ensSuffix: User['ensSuffix']
  note: string
}

export interface CreateOrderRequest {
  quoteId: string
  walletConnectionId: string
  walletSlot: WalletSlot | 'other'
  walletAddress: string
  provider: WalletProvider
  network: Network
  buyer: BuyerDetails
}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  /** Snapshot imutável da cotação no momento da compra. */
  lines: QuoteLine[]
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
  coupon: Coupon | null
  network: Network
  provider: WalletProvider
  walletAddress: string
  transactionHash: string | null
  explorerUrl: string | null
  declineReason: string | null
  createdAt: IsoDate
  updatedAt: IsoDate
  version: number
}

// ---------------------------------------------------------------------------
// Tempo real (Socket.IO)
// ---------------------------------------------------------------------------

export interface RealtimeEvent<TType extends string, TResource extends string, TData> {
  /** Identidade estável do evento; duplicatas carregam o mesmo id. */
  id: string
  type: TType
  resource: { type: TResource; id: string }
  /** Versão do recurso após a alteração. */
  version: number
  occurredAt: IsoDate
  data: TData
}

export interface NftUpdatedData {
  price: Eth
  previousPrice: Eth | null
  available: number
  editions: Pick<NftEdition, 'id' | 'price' | 'available'>[]
}

export interface OrderUpdatedData {
  userId: string
  status: OrderStatus
  transactionHash: string | null
  explorerUrl: string | null
  declineReason: string | null
}

export type NftUpdatedEvent = RealtimeEvent<'nft.updated', 'nft', NftUpdatedData>
export type OrderUpdatedEvent = RealtimeEvent<'order.updated', 'order', OrderUpdatedData>

export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
  'session.ready': (payload: { userId: string | null }) => void
}

export interface ClientToServerEvents {
  'order.subscribe': (orderId: string) => void
}
