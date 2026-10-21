import type { CreateOrderRequest } from '@/api/contracts'

/**
 * Tentativa de pedido em andamento, persistida em sessionStorage. Permite reenviar com a
 * MESMA chave de idempotência após timeout, falha de rede ou refresh — sem criar outra compra.
 */
export interface OrderAttempt {
  key: string
  userId: string
  body: CreateOrderRequest
  createdAt: number
}

const ATTEMPT_KEY = 'kurio:checkout-attempt'
const DRAFT_KEY = 'kurio:checkout-draft'

function read<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(storage: Storage, key: string, value: unknown) {
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(value))
  } catch {
    // Armazenamento indisponível: o fluxo segue apenas em memória.
  }
}

export const attemptStore = {
  get(userId: string) {
    const attempt = read<OrderAttempt>(sessionStorage, ATTEMPT_KEY)
    return attempt && attempt.userId === userId ? attempt : null
  },
  /** Reutiliza a chave quando o conteúdo é idêntico (mesma tentativa); senão cria outra. */
  begin(userId: string, body: CreateOrderRequest): OrderAttempt {
    const current = attemptStore.get(userId)
    if (current && JSON.stringify(current.body) === JSON.stringify(body)) return current
    const attempt: OrderAttempt = { key: crypto.randomUUID(), userId, body, createdAt: Date.now() }
    write(sessionStorage, ATTEMPT_KEY, attempt)
    return attempt
  },
  clear() {
    write(sessionStorage, ATTEMPT_KEY, null)
  },
}

/** Rascunho do formulário de pagamento, preservado em expiração de sessão e refresh. */
export const draftStore = {
  get<T>(userId: string): T | null {
    const draft = read<{ userId: string; values: T }>(sessionStorage, DRAFT_KEY)
    return draft && draft.userId === userId ? draft.values : null
  },
  set(userId: string, values: unknown) {
    write(sessionStorage, DRAFT_KEY, { userId, values })
  },
  clear() {
    write(sessionStorage, DRAFT_KEY, null)
  },
}
