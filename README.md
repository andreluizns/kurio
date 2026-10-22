# Kurio — Marketplace de NFTs

Implementação do desafio frontend (enunciado em [docs/DESAFIO.md](docs/DESAFIO.md)): fluxos de descoberta, compra e conta do colecionador, em desktop e mobile, fiel ao [layout no Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1).

Toda a API REST e o tempo real (Socket.IO) são simulados pelo **MSW** na camada de rede, com estado persistente, cenários de falha determinísticos e reset. Não há backend real.

- **Arquitetura, contratos, cache, sessão e decisões:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Auditoria Lighthouse:** [lighthouse/README.md](lighthouse/README.md)

## Stack

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface | React 19 + TypeScript 5.9 |
| Roteamento | TanStack Router (rotas por arquivo, `validateSearch`, guardas `beforeLoad`) |
| Estado remoto | TanStack Query 5 |
| Cliente HTTP | Axios |
| Tempo real | `socket.io-client` 4 |
| Estilo e componentes | Tailwind CSS 4 + shadcn/ui (Radix), adaptados à identidade Kurio |
| Formulários | react-hook-form + Zod |
| Mocking | MSW 2 (service worker + `ws`) + `@mswjs/socket.io-binding` |
| Testes E2E e regressão visual | Playwright |
| Auditoria | Lighthouse 13 |
| Build | Vite 8 · pnpm |

## Setup

Requisitos: **Node ≥ 20.19** e **pnpm 12** (`corepack enable` ativa a versão do `packageManager`).

```bash
pnpm install
pnpm exec playwright install chromium   # navegador dos testes e do Lighthouse
pnpm dev                                # http://localhost:5173 (mocks ativos)
```

## Variáveis de ambiente

Copie `.env.example` para `.env` se quiser alterar algo. Nenhuma variável é obrigatória.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | `false` desativa a camada MSW (API e Socket.IO simulados). |
| `VITE_MOCK_PANEL` | `true` | `false` oculta o painel de controle dos mocks. |
| `VITE_SOCKET_URL` | origem atual | Origem do servidor Socket.IO. |

## Credenciais fictícias

| Usuário | E-mail | Senha | Dados iniciais |
| --- | --- | --- | --- |
| Ana Sato | `ana@kurio.dev` | `Kurio@2026` | Carrinho igual ao do layout (Emerald ×2, Violet ×6, Ivory ×9), carteiras principal e secundária, 2 favoritos |
| Bruno Lima | `bruno@kurio.dev` | `Kurio@2026` | Carrinho vazio, só carteira principal, 1 favorito |

**Os dados ficam salvos no navegador.** A API simulada guarda tudo no `localStorage` de cada navegador, para manter o estado após o refresh. Compras, quantidades alteradas, cupons e itens adicionados continuam salvos entre visitas, então os dados iniciais da tabela só aparecem num navegador novo. Para voltar a eles, use o painel **MOCKS** → **Resetar dados e cenários** (canto inferior esquerdo no desktop, lateral esquerda no mobile) ou abra o site numa aba anônima.

Novas contas podem ser criadas em `/cadastro`. As senhas ficam no banco simulado apenas como hash SHA-256 com salt; o cliente guarda só o token de sessão.

**Cupons:** `KURIO10` (10%), `GENESIS5` (5%) e `VERAO2025` (expirado). Qualquer outro código é inválido.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Desenvolvimento com mocks |
| `pnpm build` | Verificação de tipos + build de produção (com mocks, é o build de demonstração) |
| `pnpm preview` | Serve o build em http://localhost:4173 |
| `pnpm typecheck` | `tsc -b --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test:e2e` | Playwright (gera o build, sobe o preview e roda desktop + mobile) |
| `pnpm test:e2e:update` | Regera as baselines de regressão visual |
| `pnpm test:e2e:report` | Abre o relatório HTML (traces das falhas incluídos) |
| `pnpm lighthouse` | Auditoria (requer `pnpm build && pnpm preview` rodando) |
| `pnpm assets:images` · `pnpm assets:icons` | Regera as artes WebP e os ícones a partir da exportação local do Figma |

## Cenários dos mocks

Os cenários são combináveis e podem ser escolhidos de três formas:

1. **Pela URL:** `?mock=slow,favorites-error`. O cenário fica salvo até ser trocado. `?mock=` limpa os cenários e `?mockLatency=0` define a latência base em ms.
2. **Pelo painel "MOCKS":** botão no canto inferior esquerdo. Tem checkboxes de cenários e ações do servidor (alterar preço, esgotar edição, reenviar eventos, derrubar o socket, expirar a sessão, liquidar pedidos).
3. **Pela API de controle:** `PUT /api/__mock/config` com `{ "scenarios": [...] }`, usada pelos testes.

**Reset:** o botão "Resetar dados e cenários" do painel, ou `POST /api/__mock/reset`, restaura integralmente o cenário conhecido (fixtures, cenários e sessões).

| Cenário | Efeito |
| --- | --- |
| `slow` | Latência fixa de 2,5 s (skeletons) |
| `variable-latency` | Latência variável de 100 ms a 2,2 s (respostas fora de ordem) |
| `empty-catalog` | Catálogo vazio |
| `offline` | Falha de rede em todas as chamadas |
| `server-error` | HTTP 500 em todas as consultas |
| `catalog-error` | HTTP 503 só na listagem do catálogo |
| `flaky` | 503 na 1ª tentativa de cada consulta (o retry recupera) |
| `session-expired` | 401 em qualquer chamada autenticada |
| `forbidden` | 403 em perfil, carteiras e pedidos |
| `favorites-error` | Falha (500) ao favoritar ou desfavoritar |
| `price-change-on-checkout` | Preço sobe 0,10 ETH no envio do pedido (uma vez) |
| `sold-out-on-checkout` | Edição esgota no envio do pedido (uma vez) |
| `order-timeout` | Pedido criado, mas resposta em 12 s (o cliente expira em 8 s) |
| `payment-declined` | Pagamento recusado |
| `wallet-rejected` | Usuário recusa a conexão da carteira |
| `wallet-disconnect` | Carteira desconecta antes do envio (uma vez) |
| `socket-offline` | Servidor de tempo real recusa conexões |

## Como reproduzir os fluxos de falha

Exemplos com a Ana logada (`ana@kurio.dev`):

- **Skeletons e carregamento lento:** abra `/?mock=slow`.
- **Falha e recuperação:** abra `/?mock=catalog-error`, desmarque o cenário no painel e clique em "Tentar novamente".
- **Respostas fora de ordem:** abra `/?mock=variable-latency` e troque filtros rapidamente. Só o resultado da última consulta é exibido.
- **Favorito com rollback:** abra `/?mock=favorites-error` e favorite um NFT. O estado volta e o aviso oferece "Tentar novamente".
- **Preço alterado com o carrinho aberto:** em `/carrinho`, use o painel → "Aumentar preço do 1º item". O aviso aparece e o resumo é recalculado (evento `nft.updated` via Socket.IO).
- **Cotação desatualizada no checkout:** em `/pagamento`, abra a revisão e use a mesma ação do painel. O pagamento fica bloqueado até "Atualizar cotação".
- **Preço alterado no envio:** ative `price-change-on-checkout` e pague. O novo total exige nova confirmação.
- **Timeout com idempotência:** ative `order-timeout` e pague. O cliente reenvia com a mesma chave e recupera o mesmo pedido.
- **Pagamento recusado:** ative `payment-declined`. A recusa é exibida e os itens continuam no carrinho.
- **Pedido pendente com queda de conexão:** ative `socket-offline`, use "Derrubar conexão" e, com o pedido pendente, "Liquidar pedidos" no painel. Recarregue ou desative o cenário: o recibo aparece sem criar outra compra.
- **Eventos duplicados ou antigos:** no detalhe de um NFT, altere o preço duas vezes pelo painel e use "Enviar evento com versão antiga" e "Reenviar último evento". O preço não regride.
- **Sessão expirada:** use "Expirar sessão" no painel e navegue para uma área privada. Você volta ao login com retorno ao ponto anterior; no checkout, o rascunho é preservado.

## Testes

```bash
pnpm test:e2e                                 # build + preview + suíte completa (Chromium desktop 1440 e mobile 390)
E2E_BASE_URL=http://localhost:4173 pnpm test:e2e   # reaproveita um servidor já iniciado
```

São 86 testes: 82 passam e 4 são pulados de propósito (casos exclusivos de um dos tamanhos de tela). Eles cobrem os 12 grupos do enunciado e a regressão visual de início, detalhe, carrinho e pagamento, com baselines em `e2e/__screenshots__`.

Cada teste começa num contexto novo, com reset do servidor simulado. Relógio (`page.clock`), latência e disparo de eventos são controlados pelos testes. O relatório HTML fica em `playwright-report/`, com traces das falhas.

## Deploy

O projeto está pronto para a Vercel (`vercel.json`, com fallback de SPA e cabeçalhos do service worker) e para a Netlify (`public/_redirects`). O build de produção inclui a camada de mocks ativa, então a URL publicada funciona sem backend, com acesso direto e refresh em qualquer rota.

```bash
pnpm dlx vercel --prod
```
