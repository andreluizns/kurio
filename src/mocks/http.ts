import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/api/contracts'
import { db, type DbUser } from './db'
import { getConfig, isActive } from './scenarios'
import { mulberry32 } from './seed'

export const API = '/api'

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: { fields?: Record<string, string>; details?: unknown } = {},
) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message, ...extra } }, { status })
}

let requestCounter = 0
const flakyAttempts = new Map<string, number>()

/** Latência simulada conforme o cenário ativo. */
async function simulateLatency() {
  requestCounter += 1
  if (isActive('slow')) return delay(2500)
  if (isActive('variable-latency')) {
    const rand = mulberry32(requestCounter * 7919)
    return delay(100 + Math.round(rand() * 2100))
  }
  const base = getConfig().baseLatency
  if (base <= 0) return
  const rand = mulberry32(requestCounter)
  return delay(Math.round(base * (0.6 + rand() * 0.8)))
}

/**
 * Aplica condições de rede e falhas comuns antes do handler.
 * Retorna uma resposta quando o cenário interrompe a requisição.
 */
export async function networkConditions(request: Request, { scope }: { scope: string }) {
  await simulateLatency()
  if (isActive('offline')) return HttpResponse.error()
  const isQuery = request.method === 'GET'
  if (isQuery && isActive('server-error')) {
    return apiError(500, 'INTERNAL_ERROR', 'Erro interno no servidor simulado.')
  }
  if (isQuery && isActive('flaky')) {
    const key = `${request.method} ${new URL(request.url).pathname}`
    const attempt = (flakyAttempts.get(key) ?? 0) + 1
    flakyAttempts.set(key, attempt)
    if (attempt % 2 === 1) {
      return apiError(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível.')
    }
  }
  if (scope === 'catalog' && isActive('catalog-error')) {
    return apiError(503, 'SERVICE_UNAVAILABLE', 'O catálogo está temporariamente indisponível.')
  }
  return null
}

export function bearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

/** Usuário da sessão, ou null quando não há token válido. Lança 401 para token expirado. */
export function optionalUser(request: Request): DbUser | null {
  const token = bearerToken(request)
  if (!token) return null
  const session = db().sessions[token]
  if (!session || session.expiresAt <= Date.now() || isActive('session-expired')) {
    if (session) delete db().sessions[token]
    throw apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  return db().users[session.userId] ?? null
}

export function requireUser(request: Request, { privateResource = false } = {}): DbUser {
  const user = optionalUser(request)
  if (!user) throw apiError(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.')
  if (privateResource && isActive('forbidden')) {
    throw apiError(403, 'FORBIDDEN', 'Você não tem permissão para acessar este recurso.')
  }
  return user
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw apiError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.')
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
