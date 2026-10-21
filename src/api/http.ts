import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from './contracts'
import { mocksReady } from '@/app/mocks-ready'
import { guestCart, sessionStore } from '@/features/auth/session-store'

export const REQUEST_TIMEOUT_MS = 8000

/** Erro normalizado da API, usado por queries, mutations e formulários. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELED'
  readonly fields: Record<string, string>
  readonly details: unknown

  constructor(init: { status: number; code: ApiError['code']; message: string; fields?: Record<string, string>; details?: unknown }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fields = init.fields ?? {}
    this.details = init.details
  }

  /** Falhas transitórias que podem ser repetidas com segurança. */
  get isTransient() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT' || this.status >= 500
  }

  get isAuthError() {
    return this.status === 401
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

type ExpiredListener = (error: ApiError) => void
const expiredListeners = new Set<ExpiredListener>()

/** Notificado quando uma chamada autenticada recebe 401 (sessão expirada/inválida). */
export function onSessionExpired(listener: ExpiredListener) {
  expiredListeners.add(listener)
  return () => expiredListeners.delete(listener)
}

export const http = axios.create({
  baseURL: '/api',
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use(async (config) => {
  // Nenhuma requisição sai antes de a camada de mocks (quando ativa) estar interceptando.
  await mocksReady
  const token = sessionStore.token()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  const cartId = guestCart.get()
  if (cartId && !token) config.headers.set('X-Cart-Id', cartId)
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const normalized = normalizeError(error)
    const sentToken = error instanceof AxiosError ? error.config?.headers?.Authorization : undefined
    if (normalized.status === 401 && sentToken && normalized.code !== 'INVALID_CREDENTIALS') {
      for (const listener of expiredListeners) listener(normalized)
    }
    return Promise.reject(normalized)
  },
)

function normalizeError(error: unknown): ApiError {
  if (axios.isCancel(error)) {
    return new ApiError({ status: 0, code: 'CANCELED', message: 'Requisição cancelada.' })
  }
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError({ status: 0, code: 'TIMEOUT', message: 'O servidor demorou para responder.' })
    }
    const body = error.response?.data as ApiErrorBody | undefined
    if (error.response && body?.error) {
      return new ApiError({ status: error.response.status, ...body.error })
    }
    if (error.response) {
      return new ApiError({
        status: error.response.status,
        code: error.response.status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR',
        message: 'Não foi possível concluir a operação.',
      })
    }
    return new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Sem conexão com o servidor. Verifique sua internet.' })
  }
  return new ApiError({ status: 0, code: 'INTERNAL_ERROR', message: 'Erro inesperado.' })
}

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<T>(config)
  return response.data
}
