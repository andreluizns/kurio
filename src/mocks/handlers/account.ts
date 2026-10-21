import { http, HttpResponse } from 'msw'
import type {
  FavoritesResponse,
  PasswordChange,
  ProfileUpdate,
  User,
  Wallet,
  WalletInput,
  WalletSlot,
  WalletsResponse,
} from '@/api/contracts'
import { NETWORKS } from '@/api/contracts'
import { db, hashPassword, persist, publicUser } from '../db'
import { toSummary } from '../domain'
import { API, apiError, EMAIL_RE, ETH_ADDRESS_RE, networkConditions, readJson, requireUser } from '../http'
import { isActive } from '../scenarios'
import { emailTaken, passwordProblem, USERNAME_RE, usernameTaken } from './auth'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const PROVIDERS = ['metamask', 'walletconnect', 'coinbase']
const ENS_RE = /^[a-z0-9-]{3,32}$/

function validateProfile(body: ProfileUpdate, userId: string) {
  const fields: Record<string, string> = {}
  if (!body.displayName?.trim()) fields.displayName = 'Informe o nome de exibição.'
  if (!USERNAME_RE.test(body.username ?? '')) fields.username = 'Use de 3 a 24 caracteres: letras minúsculas, números, ponto ou _.'
  else if (usernameTaken(body.username, userId)) fields.username = 'Este nome de usuário já está em uso.'
  if (!EMAIL_RE.test(body.email ?? '')) fields.email = 'Informe um e-mail válido.'
  else if (emailTaken(body.email, userId)) fields.email = 'Já existe uma conta com este e-mail.'
  if (!ENS_RE.test(body.ensName ?? '')) fields.ensName = 'Use de 3 a 32 letras minúsculas, números ou hífen.'
  if (!['.eth', '.kurio.eth'].includes(body.ensSuffix)) fields.ensSuffix = 'Sufixo inválido.'
  if (!body.walletNickname?.trim()) fields.walletNickname = 'Informe o apelido da carteira.'
  return fields
}

function validateWallet(body: WalletInput) {
  const fields: Record<string, string> = {}
  if (!body.displayName?.trim()) fields.displayName = 'Informe o nome de exibição.'
  if (!body.nickname?.trim()) fields.nickname = 'Informe o apelido da carteira.'
  if (!NETWORKS.includes(body.network)) fields.network = 'Selecione uma rede.'
  if (!body.profileName?.trim()) fields.profileName = 'Informe o nome do perfil.'
  if (!ETH_ADDRESS_RE.test(body.address ?? '')) fields.address = 'Informe um endereço 0x com 40 caracteres hexadecimais.'
  if (body.secondaryAddress && !ETH_ADDRESS_RE.test(body.secondaryAddress) && !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(body.secondaryAddress)) {
    fields.secondaryAddress = 'Informe um endereço 0x ou um nome ENS (ex.: nome.eth).'
  }
  if (!PROVIDERS.includes(body.provider)) fields.provider = 'Selecione uma carteira.'
  if (!/^[A-Z0-9-]{4,20}$/.test(body.referralCode ?? '')) fields.referralCode = 'Use de 4 a 20 letras maiúsculas, números ou hífen.'
  if (!EMAIL_RE.test(body.email ?? '')) fields.email = 'Informe um e-mail válido.'
  if (!ENS_RE.test(body.ensName ?? '')) fields.ensName = 'Use de 3 a 32 letras minúsculas, números ou hífen.'
  return fields
}

async function fileToDataUrl(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${file.type};base64,${btoa(binary)}`
}

export const accountHandlers = [
  // Perfil -------------------------------------------------------------------
  http.get(`${API}/profile`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'account' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    return HttpResponse.json<User>(publicUser(user))
  }),

  http.put(`${API}/profile`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'account' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    const body = await readJson<ProfileUpdate>(request)
    const normalized: ProfileUpdate = {
      displayName: String(body.displayName ?? '').trim(),
      username: String(body.username ?? '').trim().toLowerCase(),
      email: String(body.email ?? '').trim().toLowerCase(),
      ensName: String(body.ensName ?? '').trim().toLowerCase(),
      ensSuffix: body.ensSuffix,
      walletNickname: String(body.walletNickname ?? '').trim(),
    }
    const fields = validateProfile(normalized, user.id)
    if (Object.keys(fields).length) {
      const conflict = fields.username?.includes('em uso') || fields.email?.includes('Já existe')
      return apiError(conflict ? 409 : 422, conflict ? 'CONFLICT' : 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields })
    }
    Object.assign(user, normalized)
    persist()
    return HttpResponse.json<User>(publicUser(user))
  }),

  http.post(`${API}/profile/avatar`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'account' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    const form = await request.formData().catch(() => null)
    const file = form?.get('avatar')
    if (!(file instanceof File)) return apiError(422, 'VALIDATION_ERROR', 'Selecione uma imagem.', { fields: { avatar: 'Selecione uma imagem.' } })
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      return apiError(422, 'VALIDATION_ERROR', 'Formato não suportado.', { fields: { avatar: 'Use PNG, JPG ou WebP.' } })
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return apiError(422, 'VALIDATION_ERROR', 'Imagem muito grande.', { fields: { avatar: 'A imagem deve ter até 2 MB.' } })
    }
    user.avatarUrl = await fileToDataUrl(file)
    persist()
    return HttpResponse.json<User>(publicUser(user))
  }),

  http.delete(`${API}/profile/avatar`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'account' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    user.avatarUrl = null
    persist()
    return HttpResponse.json<User>(publicUser(user))
  }),

  http.post(`${API}/profile/password`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'account' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    const body = await readJson<PasswordChange>(request)
    if ((await hashPassword(String(body.currentPassword ?? ''), user.salt)) !== user.passwordHash) {
      return apiError(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', { fields: { currentPassword: 'Senha atual incorreta.' } })
    }
    const weak = passwordProblem(String(body.newPassword ?? ''))
    if (weak) return apiError(422, 'VALIDATION_ERROR', weak, { fields: { newPassword: weak } })
    if (body.newPassword === body.currentPassword) {
      return apiError(422, 'VALIDATION_ERROR', 'A nova senha deve ser diferente da atual.', {
        fields: { newPassword: 'A nova senha deve ser diferente da atual.' },
      })
    }
    user.passwordHash = await hashPassword(body.newPassword, user.salt)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  // Carteiras ------------------------------------------------------------------
  http.get(`${API}/wallets`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'account' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    return HttpResponse.json<WalletsResponse>(db().wallets[user.id] ?? { primary: null, secondary: null })
  }),

  http.put(`${API}/wallets/:slot`, async ({ request, params }) => {
    const blocked = await networkConditions(request, { scope: 'account' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    const slot = String(params.slot) as WalletSlot
    if (slot !== 'primary' && slot !== 'secondary') return apiError(404, 'NOT_FOUND', 'Carteira inexistente.')
    const wallets = (db().wallets[user.id] ??= { primary: null, secondary: null })
    if (slot === 'secondary' && !wallets.primary) {
      return apiError(409, 'CONFLICT', 'Cadastre a carteira principal antes da secundária.')
    }
    const body = await readJson<WalletInput>(request)
    const fields = validateWallet(body)
    if (Object.keys(fields).length) return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields })
    const wallet: Wallet = { ...body, slot, updatedAt: new Date().toISOString() }
    wallets[slot] = wallet
    persist()
    return HttpResponse.json<Wallet>(wallet)
  }),

  http.delete(`${API}/wallets/secondary`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'account' })
    if (blocked) return blocked
    const user = requireUser(request, { privateResource: true })
    const wallets = db().wallets[user.id]
    if (wallets) wallets.secondary = null
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  // Favoritos -----------------------------------------------------------------
  http.get(`${API}/favorites`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'favorites' })
    if (blocked) return blocked
    const user = requireUser(request)
    const ids = db().favorites[user.id] ?? []
    const nfts = db().nfts
    return HttpResponse.json<FavoritesResponse>({
      nftIds: ids,
      items: ids.flatMap((id) => (nfts[id] ? [toSummary(nfts[id])] : [])),
    })
  }),

  http.put(`${API}/favorites/:nftId`, async ({ request, params }) => {
    const blocked = await networkConditions(request, { scope: 'favorites' })
    if (blocked) return blocked
    const user = requireUser(request)
    if (isActive('favorites-error')) return apiError(500, 'INTERNAL_ERROR', 'Não foi possível salvar o favorito.')
    const id = String(params.nftId)
    if (!db().nfts[id]) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    const list = (db().favorites[user.id] ??= [])
    if (!list.includes(id)) list.unshift(id)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete(`${API}/favorites/:nftId`, async ({ request, params }) => {
    const blocked = await networkConditions(request, { scope: 'favorites' })
    if (blocked) return blocked
    const user = requireUser(request)
    if (isActive('favorites-error')) return apiError(500, 'INTERNAL_ERROR', 'Não foi possível remover o favorito.')
    const id = String(params.nftId)
    db().favorites[user.id] = (db().favorites[user.id] ?? []).filter((f) => f !== id)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]
