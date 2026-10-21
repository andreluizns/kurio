import { mocksEnabled } from '@/app/env'
import { markMocksReady } from '@/app/mocks-ready'
import { renderApp } from '@/app/render'
import './index.css'

async function startMockLayer() {
  if (mocksEnabled) {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
    // Sinal para testes/automação: interceptação ativa.
    document.documentElement.dataset.mocks = 'ready'
  }
  markMocksReady()
}

// A interface renderiza em paralelo à inicialização dos mocks (skeletons aparecem antes);
// o cliente HTTP e o Socket.IO aguardam `mocksReady` antes de acessar a rede.
void startMockLayer()
renderApp(document.getElementById('root')!)
