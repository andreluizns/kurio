import { test as base, expect, type Page } from '@playwright/test'

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio@2026', name: 'Ana' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio@2026', name: 'Bruno' },
}

type Json = Record<string, unknown>

/** Controle do servidor simulado (MSW) pelos endpoints /api/__mock, executados dentro da página. */
export class MockServer {
  constructor(private readonly page: Page) {}

  private async call<T = Json>(path: string, body?: unknown, method = 'POST'): Promise<T> {
    await this.page.waitForFunction(() => document.documentElement.dataset.mocks === 'ready')
    return this.page.evaluate(
      async ({ path, body, method }) => {
        const res = await fetch(`/api/__mock${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        return res.json()
      },
      { path, body, method },
    ) as Promise<T>
  }

  reset() {
    return this.call('/reset')
  }
  config(patch: { scenarios?: string[]; baseLatency?: number; settleDelayMs?: number }) {
    return this.call('/config', patch, 'PUT')
  }
  scenarios(...scenarios: string[]) {
    return this.config({ scenarios })
  }
  updateNft(id: string, body: { editionId?: string; price?: string; priceDelta?: string; available?: number }) {
    return this.call(`/nfts/${id}`, body)
  }
  expireSessions() {
    return this.call('/sessions/expire')
  }
  disconnectSockets() {
    return this.call('/socket/disconnect')
  }
  replay(mode: 'duplicate' | 'stale', type?: 'nft.updated' | 'order.updated') {
    return this.call('/events/replay', { mode, type })
  }
  settleOrders() {
    return this.call('/orders/settle')
  }
  state() {
    return this.call<{ sockets: { userId: string | null }[]; pendingOrders: string[] }>('/state', undefined, 'GET')
  }
}

export const test = base.extend<{ mock: MockServer; isMobile: boolean }>({
  mock: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('kurio:hide-mock-panel', '1')
    })
    // Estado isolado: novo contexto + reset dos dados e cenários do servidor simulado.
    await page.goto('/?mockLatency=60')
    const mock = new MockServer(page)
    await mock.reset()
    await mock.config({ baseLatency: 60, settleDelayMs: 1500 })
    await use(mock)
  },
  isMobile: async ({ viewport }, use) => {
    await use((viewport?.width ?? 1440) < 768)
  },
})

export { expect }

export async function login(page: Page, user: keyof typeof USERS = 'ana', target = '/') {
  await page.goto(`/entrar?redirect=${encodeURIComponent(target)}`)
  await page.getByPlaceholder('contato@email.com').fill(USERS[user].email)
  await page.getByPlaceholder('Senha', { exact: true }).fill(USERS[user].password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${target === '/' ? '/$' : target.replace(/[?]/g, '\\?')}`))
}

export async function waitForRealtime(mock: MockServer, userId?: string) {
  await expect
    .poll(async () => (await mock.state()).sockets.some((s) => (userId ? s.userId === userId : true)), { timeout: 10_000 })
    .toBe(true)
}
