import type {
  NftDetail,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  Quote,
  User,
  Wallet,
  WalletConnection,
} from '@/api/contracts'
import {
  SEED_CARTS,
  SEED_FAVORITES,
  SEED_USERS,
  SEED_WALLETS,
  seedNfts,
} from './seed'

export interface DbUser extends User {
  passwordHash: string
  salt: string
}

export interface DbSession {
  token: string
  userId: string
  expiresAt: number
}

export interface DbCartLine {
  id: string
  nftId: string
  editionId: string
  quantity: number
  /** Preço unitário reconhecido pelo usuário (para destacar mudanças). */
  ackPrice: string
  addedAt: number
}

export interface DbCart {
  id: string
  ownerId: string | null
  lines: DbCartLine[]
  couponCode: string | null
  version: number
  updatedAt: number
}

export interface DbQuote extends Quote {
  userId: string
  cartId: string
}

export interface DbOrder extends Order {
  idempotencyKey: string
  requestHash: string
  cartId: string
  /** Instante (ms) em que o pedido pendente será liquidado. */
  settleAt: number
  outcome: 'confirmed' | 'declined'
}

export interface DbWalletConnection extends WalletConnection {
  userId: string
  active: boolean
}

export type StoredEvent = NftUpdatedEvent | OrderUpdatedEvent

export interface Db {
  schema: 1
  nfts: Record<string, NftDetail>
  /** Ordem estável de inserção (para desempates). */
  nftOrder: string[]
  users: Record<string, DbUser>
  sessions: Record<string, DbSession>
  carts: Record<string, DbCart>
  favorites: Record<string, string[]>
  wallets: Record<string, { primary: Wallet | null; secondary: Wallet | null }>
  quotes: Record<string, DbQuote>
  orders: Record<string, DbOrder>
  idempotency: Record<string, { userId: string; hash: string; orderId: string }>
  walletConnections: Record<string, DbWalletConnection>
  /** Contador monotônico para ids determinísticos. */
  seq: number
  /** Últimos eventos emitidos (para reenvio de duplicatas/eventos antigos nos testes). */
  events: StoredEvent[]
}

const DB_KEY = 'kurio:mock-db:v1'

let state: Db | null = null

export async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function buildSeed(): Promise<Db> {
  const nfts = seedNfts()
  const db: Db = {
    schema: 1,
    nfts: Object.fromEntries(nfts.map((n) => [n.id, n])),
    nftOrder: nfts.map((n) => n.id),
    users: {},
    sessions: {},
    carts: {},
    favorites: structuredClone(SEED_FAVORITES),
    wallets: structuredClone(SEED_WALLETS),
    quotes: {},
    orders: {},
    idempotency: {},
    walletConnections: {},
    seq: 1000,
    events: [],
  }
  for (const { password, ...user } of SEED_USERS) {
    const salt = `salt-${user.id}`
    db.users[user.id] = { ...user, salt, passwordHash: await hashPassword(password, salt) }
    const cartId = `cart_${user.id}`
    db.carts[cartId] = {
      id: cartId,
      ownerId: user.id,
      couponCode: null,
      version: 1,
      updatedAt: Date.now(),
      lines: SEED_CARTS[user.id].map((line, i) => {
        const nft = db.nfts[line.nftId]
        const edition = nft.editions.find((e) => e.label === line.editionLabel)!
        return {
          id: `line_${user.id}_${i + 1}`,
          nftId: nft.id,
          editionId: edition.id,
          quantity: line.quantity,
          ackPrice: edition.price,
          addedAt: Date.now(),
        }
      }),
    }
  }
  return db
}

export async function initDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (parsed.schema === 1) {
        state = parsed
        return state
      }
    }
  } catch {
    // Persistência corrompida ou indisponível: recomeça do seed.
  }
  state = await buildSeed()
  persist()
  return state
}

export async function resetDb() {
  state = await buildSeed()
  persist()
  return state
}

export function db(): Db {
  if (!state) throw new Error('Mock DB não inicializado')
  return state
}

export function persist() {
  if (!state) return
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(state))
  } catch {
    // Sem persistência (modo privado): o estado segue em memória.
  }
}

export function nextId(prefix: string) {
  const d = db()
  d.seq += 1
  return `${prefix}_${d.seq.toString(36)}`
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function publicUser(user: DbUser): User {
  const { passwordHash: _hash, salt: _salt, ...rest } = user
  return rest
}
