import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Cart } from '@/api/contracts'
import { queryKeys } from '@/api/query-keys'
import { sessionStore } from '@/features/auth/session-store'
import { useRealtimeStatus } from '@/features/realtime/status'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SCENARIOS, type MockConfig, type ScenarioId } from '../scenarios'

/**
 * Painel de demonstração: controla o servidor simulado via endpoints /api/__mock.
 * As alterações chegam à interface pelos mesmos caminhos de produção (REST e Socket.IO).
 */
async function admin<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(`/api/__mock${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `HTTP ${res.status}`)
  return res.json() as Promise<T>
}

const HIDE_KEY = 'kurio:hide-mock-panel'

export default function MockPanel() {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<MockConfig | null>(null)
  const status = useRealtimeStatus()
  const qc = useQueryClient()
  const hidden = (() => {
    try {
      return localStorage.getItem(HIDE_KEY) === '1'
    } catch {
      return false
    }
  })()

  useEffect(() => {
    if (open) void admin<{ config: MockConfig }>('/state', undefined, 'GET').then((s) => setConfig(s.config))
  }, [open])

  if (hidden) return null

  const firstCartNft = () => {
    const owner = sessionStore.userId() ?? 'guest'
    const cart = qc.getQueryData<Cart>(queryKeys.cart(owner))
    const item = cart?.items[0]
    return item ? { id: item.nftId, editionId: item.editionId, name: item.name } : { id: 'nft-emerald-ape-042', editionId: undefined, name: 'Emerald Ape #042' }
  }

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
      toast.message(`Mock: ${label}`)
    } catch (error) {
      toast.error(`Mock: ${(error as Error).message}`)
    }
  }

  const toggleScenario = async (id: ScenarioId, on: boolean) => {
    const scenarios = on ? [...(config?.scenarios ?? []), id] : (config?.scenarios ?? []).filter((s) => s !== id)
    setConfig(await admin<MockConfig>('/config', { scenarios }, 'PUT'))
  }

  const actionClass = 'rounded border border-line px-3 py-2 text-left text-xs text-cream hover:border-brand'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-1/2 left-0 z-[60] -translate-y-1/2 rounded-r-full border border-l-0 border-brand bg-ink/90 px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-brand-light shadow-lift md:top-auto md:bottom-4 md:left-3 md:translate-y-0 md:rounded-full md:border-l md:px-3"
        aria-label="Abrir painel de mocks"
      >
        MOCKS · {status === 'connected' ? 'online' : status}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[360px] overflow-y-auto p-5">
          <SheetHeader className="p-0">
            <SheetTitle>Servidor simulado</SheetTitle>
            <SheetDescription>Cenários determinísticos (MSW) e eventos Socket.IO. Tempo real: {status}.</SheetDescription>
          </SheetHeader>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-cream">Ações do servidor</h3>
            <button className={actionClass} onClick={() => { const n = firstCartNft(); void run(`preço +0,10 ETH em ${n.name}`, () => admin(`/nfts/${n.id}`, { editionId: n.editionId, priceDelta: '0.1' })) }}>
              Aumentar preço (+0,10 ETH) do 1º item do carrinho
            </button>
            <button className={actionClass} onClick={() => { const n = firstCartNft(); void run(`edição esgotada em ${n.name}`, () => admin(`/nfts/${n.id}`, { editionId: n.editionId, available: 0 })) }}>
              Esgotar a edição do 1º item do carrinho
            </button>
            <button className={actionClass} onClick={() => void run('evento duplicado reenviado', () => admin('/events/replay', { mode: 'duplicate' }))}>
              Reenviar último evento (duplicata)
            </button>
            <button className={actionClass} onClick={() => void run('evento antigo enviado', () => admin('/events/replay', { mode: 'stale' }))}>
              Enviar evento com versão antiga
            </button>
            <button className={actionClass} onClick={() => void run('conexões Socket.IO encerradas', () => admin('/socket/disconnect'))}>
              Derrubar conexão em tempo real
            </button>
            <button className={actionClass} onClick={() => void run('pedidos pendentes liquidados', () => admin('/orders/settle'))}>
              Liquidar pedidos pendentes agora
            </button>
            <button className={actionClass} onClick={() => void run('sessões expiradas', () => admin('/sessions/expire'))}>
              Expirar sessão no servidor
            </button>
            <button
              className={`${actionClass} border-coral/60`}
              onClick={() =>
                void run('cenário restaurado', async () => {
                  await admin('/reset')
                  localStorage.removeItem('kurio:session')
                  localStorage.removeItem('kurio:guest-cart')
                  location.assign('/')
                })
              }
            >
              Resetar dados e cenários
            </button>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-cream">Cenários</h3>
            {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
              <label key={id} className="flex items-start gap-2 text-xs text-sand">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[#d28a4c]"
                  checked={config?.scenarios.includes(id) ?? false}
                  disabled={!config}
                  onChange={(e) => void toggleScenario(id, e.target.checked)}
                />
                <span>
                  <code className="text-brand-light">{id}</code> — {SCENARIOS[id]}
                </span>
              </label>
            ))}
          </section>
          <p className="text-[11px] leading-4 text-khaki">
            Também é possível ativar por URL: <code>?mock=slow,favorites-error</code>. Credenciais: ana@kurio.dev ou bruno@kurio.dev, senha Kurio@2026.
          </p>
        </SheetContent>
      </Sheet>
    </>
  )
}
