import { useSyncExternalStore } from 'react'
import type { Session, User } from '@/api/contracts'

/**
 * Sessão persistida no localStorage (token opaco emitido pela API simulada).
 * A senha nunca é armazenada no cliente.
 */
const SESSION_KEY = 'kurio:session'
const GUEST_CART_KEY = 'kurio:guest-cart'

type Listener = () => void
const listeners = new Set<Listener>()

function read(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

let current: Session | null = read()

function emit() {
  for (const l of listeners) l()
}

export const sessionStore = {
  get: () => current,
  token: () => current?.token ?? null,
  userId: () => current?.user.id ?? null,
  set(session: Session | null) {
    current = session
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      // Sem persistência: mantém em memória.
    }
    emit()
  },
  updateUser(user: User) {
    if (!current) return
    sessionStore.set({ ...current, user })
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

// Mantém abas sincronizadas (login/logout em outra aba).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SESSION_KEY) {
      current = read()
      emit()
    }
  })
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

export const guestCart = {
  get(): string | null {
    try {
      return localStorage.getItem(GUEST_CART_KEY)
    } catch {
      return null
    }
  },
  set(id: string | null) {
    try {
      if (id) localStorage.setItem(GUEST_CART_KEY, id)
      else localStorage.removeItem(GUEST_CART_KEY)
    } catch {
      // ignora
    }
  },
}
