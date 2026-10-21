import { http, HttpResponse } from 'msw'
import { add } from '@/lib/money'
import { db, persist, resetDb } from '../db'
import { refreshDerived } from '../domain'
import { API, apiError, readJson } from '../http'
import { connectedClients, disconnectAll, publishNftUpdated, replayEvent } from '../realtime'
import { getConfig, resetConfig, SCENARIOS, setConfig, type MockConfig } from '../scenarios'
import { resumePendingOrders, settleAllNow } from './commerce'

/**
 * Controle do servidor simulado (painel de mocks e testes). Estes endpoints alteram o
 * "backend" — as mudanças chegam à interface pelas respostas REST e pelos eventos Socket.IO.
 */
export const adminHandlers = [
  http.get(`${API}/__mock/state`, () =>
    HttpResponse.json({
      config: getConfig(),
      scenarios: SCENARIOS,
      sockets: connectedClients(),
      pendingOrders: Object.values(db().orders).filter((o) => o.status === 'pending').map((o) => o.id),
    }),
  ),

  http.put(`${API}/__mock/config`, async ({ request }) => {
    const body = await readJson<Partial<MockConfig>>(request)
    return HttpResponse.json(setConfig(body))
  }),

  http.post(`${API}/__mock/reset`, async ({ request }) => {
    const body = await request.json().catch(() => ({})) as { keepConfig?: boolean }
    if (!body.keepConfig) resetConfig()
    await resetDb()
    resumePendingOrders()
    disconnectAll()
    return HttpResponse.json({ ok: true, config: getConfig() })
  }),

  /** Altera preço e/ou disponibilidade de uma edição e publica `nft.updated`. */
  http.post(`${API}/__mock/nfts/:id`, async ({ request, params }) => {
    const nft = db().nfts[String(params.id)]
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    const body = await readJson<{ editionId?: string; price?: string; priceDelta?: string; available?: number }>(request)
    const edition = nft.editions.find((e) => e.id === (body.editionId ?? nft.defaultEditionId))
    if (!edition) return apiError(404, 'NOT_FOUND', 'Edição não encontrada.')
    if (body.price) edition.price = body.price
    if (body.priceDelta) edition.price = add(edition.price, body.priceDelta)
    if (typeof body.available === 'number') edition.available = Math.max(0, Math.floor(body.available))
    const before = nft.price
    refreshDerived(nft)
    if (before !== nft.price) nft.previousPrice = null
    nft.version += 1
    persist()
    const event = publishNftUpdated(nft)
    return HttpResponse.json({ nft, event })
  }),

  http.post(`${API}/__mock/sessions/expire`, () => {
    for (const session of Object.values(db().sessions)) session.expiresAt = Date.now() - 1
    persist()
    return HttpResponse.json({ ok: true })
  }),

  http.post(`${API}/__mock/socket/disconnect`, () => {
    disconnectAll()
    return HttpResponse.json({ ok: true })
  }),

  http.post(`${API}/__mock/events/replay`, async ({ request }) => {
    const body = await readJson<{ mode: 'duplicate' | 'stale'; type?: 'nft.updated' | 'order.updated' }>(request)
    const event = replayEvent(body.mode, body.type)
    if (!event) return apiError(404, 'NOT_FOUND', 'Nenhum evento para reenviar.')
    return HttpResponse.json({ event })
  }),

  http.post(`${API}/__mock/orders/settle`, () => {
    settleAllNow()
    return HttpResponse.json({ ok: true })
  }),
]
