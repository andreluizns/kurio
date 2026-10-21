import { setupWorker } from 'msw/browser'
import { initDb } from './db'
import { accountHandlers } from './handlers/account'
import { adminHandlers } from './handlers/admin'
import { authHandlers } from './handlers/auth'
import { catalogHandlers } from './handlers/catalog'
import { commerceHandlers, resumePendingOrders } from './handlers/commerce'
import { realtimeHandler } from './realtime'
import { applyConfigFromUrl } from './scenarios'

export async function startMocks() {
  applyConfigFromUrl(location.search)
  const worker = setupWorker(
    ...adminHandlers,
    ...catalogHandlers,
    ...authHandlers,
    ...accountHandlers,
    ...commerceHandlers,
    realtimeHandler(),
  )
  // Banco simulado e service worker iniciam em paralelo; nenhuma requisição sai antes de ambos.
  const db = initDb().then(() => {
    resumePendingOrders()
  })
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    // Assets estáticos e módulos do Vite seguem direto para a rede.
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  })
  await db
  if (import.meta.env.DEV) Object.assign(window, { __mswWorker: worker })
  return worker
}
