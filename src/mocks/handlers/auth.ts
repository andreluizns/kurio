import { http, HttpResponse } from 'msw'
import type { LoginRequest, RegisterRequest, Session } from '@/api/contracts'
import { db, hashPassword, nextId, persist, publicUser, randomToken, type DbUser } from '../db'
import { API, apiError, bearerToken, EMAIL_RE, networkConditions, optionalUser, readJson } from '../http'

export const SESSION_TTL_MS = 30 * 60_000
const RESERVED_USERNAMES = ['admin', 'kurio', 'suporte', 'root']
export const USERNAME_RE = /^[a-z0-9._]{3,24}$/

export function passwordProblem(password: string) {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use letras e números na senha.'
  return null
}

function createSession(user: DbUser): Session {
  const token = randomToken()
  const expiresAt = Date.now() + SESSION_TTL_MS
  db().sessions[token] = { token, userId: user.id, expiresAt }
  persist()
  return { token, user: publicUser(user), expiresAt: new Date(expiresAt).toISOString() }
}

export function emailTaken(email: string, exceptUserId?: string) {
  return Object.values(db().users).some((u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== exceptUserId)
}

export function usernameTaken(username: string, exceptUserId?: string) {
  return (
    RESERVED_USERNAMES.includes(username.toLowerCase()) ||
    Object.values(db().users).some((u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== exceptUserId)
  )
}

export const authHandlers = [
  http.post(`${API}/auth/register`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'auth' })
    if (blocked) return blocked
    const body = await readJson<RegisterRequest>(request)
    const username = String(body.username ?? '').trim().toLowerCase()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    const fields: Record<string, string> = {}
    if (!USERNAME_RE.test(username)) fields.username = 'Use de 3 a 24 caracteres: letras minúsculas, números, ponto ou _.'
    if (!EMAIL_RE.test(email)) fields.email = 'Informe um e-mail válido.'
    const weak = passwordProblem(password)
    if (weak) fields.password = weak
    if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields })

    const conflicts: Record<string, string> = {}
    if (emailTaken(email)) conflicts.email = 'Já existe uma conta com este e-mail.'
    if (usernameTaken(username)) conflicts.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(conflicts).length) {
      return apiError(409, conflicts.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Não foi possível criar a conta.', {
        fields: conflicts,
      })
    }

    const id = nextId('usr')
    const salt = randomToken().slice(0, 16)
    const user: DbUser = {
      id,
      username,
      displayName: username,
      email,
      ensName: '',
      ensSuffix: '.eth',
      walletNickname: '',
      avatarUrl: null,
      salt,
      passwordHash: await hashPassword(password, salt),
    }
    const d = db()
    d.users[id] = user
    d.wallets[id] = { primary: null, secondary: null }
    d.favorites[id] = []
    return HttpResponse.json<Session>(createSession(user), { status: 201 })
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'auth' })
    if (blocked) return blocked
    const body = await readJson<LoginRequest>(request)
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const fields: Record<string, string> = {}
    if (!EMAIL_RE.test(email)) fields.email = 'Informe um e-mail válido.'
    if (!password) fields.password = 'Informe sua senha.'
    if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields })

    const user = Object.values(db().users).find((u) => u.email.toLowerCase() === email)
    if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) {
      return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    }
    return HttpResponse.json<Session>(createSession(user))
  }),

  http.get(`${API}/auth/session`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'auth' })
    if (blocked) return blocked
    const user = optionalUser(request)
    const token = bearerToken(request)
    if (!user || !token) return apiError(401, 'UNAUTHENTICATED', 'Nenhuma sessão ativa.')
    const session = db().sessions[token]
    return HttpResponse.json<Session>({
      token,
      user: publicUser(user),
      expiresAt: new Date(session.expiresAt).toISOString(),
    })
  }),

  http.post(`${API}/auth/logout`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'auth' })
    if (blocked) return blocked
    const token = bearerToken(request)
    if (token) {
      delete db().sessions[token]
      persist()
    }
    return new HttpResponse(null, { status: 204 })
  }),
]
