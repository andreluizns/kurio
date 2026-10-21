/**
 * Cenários determinísticos da API simulada. São combináveis e podem ser ativados por
 * `?mock=slow,favorites-error` na URL, pelo painel de mocks ou por `PUT /api/__mock/config`.
 */
export const SCENARIOS = {
  slow: 'Latência alta fixa (2,5 s) em todas as respostas',
  'variable-latency': 'Latência variável (100 ms–2,2 s) com respostas fora de ordem',
  'empty-catalog': 'Catálogo sem resultados',
  offline: 'Sem conexão: todas as chamadas falham na rede',
  'server-error': 'HTTP 500 em todas as consultas (GET)',
  'catalog-error': 'HTTP 503 apenas na listagem do catálogo',
  flaky: 'Falha transitória (503) na primeira tentativa de cada consulta',
  'session-expired': 'Toda chamada autenticada responde 401 (sessão expirada)',
  forbidden: 'Perfil, carteiras e pedidos respondem 403',
  'favorites-error': 'Inclusão e remoção de favoritos falham (500)',
  'price-change-on-checkout': 'O preço muda no momento de confirmar a compra',
  'sold-out-on-checkout': 'A edição esgota no momento de confirmar a compra',
  'order-timeout': 'O pedido é criado, mas a resposta excede o timeout do cliente',
  'payment-declined': 'O pagamento é recusado na simulação',
  'wallet-rejected': 'O usuário recusa a conexão da carteira',
  'wallet-disconnect': 'A carteira se desconecta antes do envio do pedido',
  'socket-offline': 'O servidor de tempo real recusa conexões',
} as const

export type ScenarioId = keyof typeof SCENARIOS

export interface MockConfig {
  scenarios: ScenarioId[]
  /** Latência base em ms quando nenhum cenário de latência está ativo. */
  baseLatency: number
  /** Tempo até o pedido pendente ser liquidado (confirmado ou recusado). */
  settleDelayMs: number
}

const CONFIG_KEY = 'kurio:mock-config'

export const DEFAULT_CONFIG: MockConfig = {
  scenarios: [],
  baseLatency: 250,
  settleDelayMs: 2500,
}

let current: MockConfig = loadConfig()

function loadConfig(): MockConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<MockConfig>) }
  } catch {
    // Armazenamento indisponível: usa o padrão.
  }
  return { ...DEFAULT_CONFIG }
}

export function getConfig(): MockConfig {
  return current
}

export function setConfig(patch: Partial<MockConfig>) {
  current = { ...current, ...patch }
  if (patch.scenarios) {
    current.scenarios = patch.scenarios.filter((s): s is ScenarioId => s in SCENARIOS)
  }
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(current))
  } catch {
    // Mantém apenas em memória.
  }
  return current
}

export function resetConfig() {
  return setConfig({ ...DEFAULT_CONFIG })
}

export function isActive(id: ScenarioId) {
  return current.scenarios.includes(id)
}

/** Lê `?mock=a,b` e `?mockLatency=ms` da URL atual e aplica antes de iniciar os mocks. */
export function applyConfigFromUrl(search: string) {
  const params = new URLSearchParams(search)
  const mock = params.get('mock')
  const latency = params.get('mockLatency')
  if (mock !== null) {
    setConfig({ scenarios: mock.split(',').map((s) => s.trim()).filter(Boolean) as ScenarioId[] })
  }
  if (latency !== null && !Number.isNaN(Number(latency))) {
    setConfig({ baseLatency: Number(latency) })
  }
}
