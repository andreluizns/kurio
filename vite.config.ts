import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

/**
 * Com os mocks ativos, inicia o registro do service worker do MSW direto no HTML, em paralelo
 * ao download do JavaScript (o `worker.start()` reaproveita o registro e só aguarda a ativação).
 */
function earlyMockWorker(enabled: boolean): Plugin {
  return {
    name: 'kurio:early-mock-worker',
    transformIndexHtml: () =>
      enabled
        ? [
            {
              tag: 'script',
              injectTo: 'head',
              children: "if('serviceWorker' in navigator)navigator.serviceWorker.register('/mockServiceWorker.js').catch(function(){})",
            },
          ]
        : [],
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        // Páginas de entrada (início e detalhe) ficam no bundle principal: sem ida extra à rede
        // no primeiro carregamento. As demais rotas (checkout, conta, auth) são carregadas sob demanda.
        codeSplittingOptions: {
          splitBehavior: ({ routeId }) => (routeId === '/' || routeId === '/nft/$nftId' ? [] : undefined),
        },
      }),
      react(),
      tailwindcss(),
      earlyMockWorker(env.VITE_ENABLE_MOCKS !== 'false'),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Cookies não são usados pela API simulada (autenticação por Bearer); ver src/mocks/shims.
        'tough-cookie': fileURLToPath(new URL('./src/mocks/shims/tough-cookie.ts', import.meta.url)),
      },
    },
    // Pré-empacota as dependências dos mocks juntas: o interceptador de WebSocket do MSW é um
    // singleton e não pode ser duplicado entre otimizações diferentes.
    optimizeDeps: { include: ['msw', 'msw/browser', '@mswjs/socket.io-binding', 'socket.io-client'] },
    server: { port: 5173 },
    preview: { port: 4173 },
  }
})
