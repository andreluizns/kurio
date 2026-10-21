# Arquitetura

## Visão geral

```
src/
  api/            contratos tipados (contracts.ts), cliente Axios (http.ts), endpoints e chaves de cache
  app/            bootstrap, QueryClient, router, sinal de mocks prontos
  routes/         rotas TanStack Router (arquivos), guardas e validação de search params
  features/       catálogo, detalhe, carrinho, checkout, pedidos, auth, conta, favoritos, tempo real
  components/     layout (cabeçalho, rodapé, tab bar), ícones gerados do Figma, shadcn/ui adaptado, formulários
  mocks/          servidor simulado: banco, seed, domínio, handlers REST, Socket.IO, cenários, painel
  lib/            dinheiro (big.js), formatação, media queries, utilitários
e2e/              Playwright (fixtures, specs, baselines visuais)
lighthouse/       configuração, script e relatórios da auditoria
design/           exportação local do Figma (não versionada)
```

### Fluxo de dados

1. **Contratos únicos.** `src/api/contracts.ts` define os tipos usados por handlers MSW, endpoints, cache e interface. Valores em ETH trafegam como strings decimais, e todo cálculo usa `big.js` (`src/lib/money.ts`).
2. **Axios.** Todas as chamadas REST passam por `http.ts`, que:
   - aguarda os mocks ficarem prontos;
   - injeta `Authorization` e `X-Cart-Id`;
   - normaliza qualquer erro em `ApiError` (`status`, `code`, `fields`, `details`);
   - avisa a aplicação quando recebe 401.
3. **TanStack Query.** Guarda consultas, mutations e cache. Os componentes nunca usam respostas fixas: tudo vem da API simulada.
4. **TanStack Router.** Controla rotas, search params validados (estado do catálogo na URL), guardas de rotas privadas e páginas 404.
5. **Socket.IO.** Um socket por sessão. Eventos atualizam o cache de forma idempotente e disparam reconciliação via REST.

## Contratos REST

Base `/api`. Erros seguem `{ error: { code, message, fields?, details? } }`.

| Recurso | Método e rota | Respostas e erros |
| --- | --- | --- |
| Sessão | `POST /auth/register` `{username,email,password}` | 201 `Session` · 422 `VALIDATION_ERROR` · 409 `EMAIL_TAKEN`/`USERNAME_TAKEN` (com `fields`) |
| | `POST /auth/login` | 200 `Session` · 401 `INVALID_CREDENTIALS` · 422 |
| | `GET /auth/session` | 200 `Session` · 401 `SESSION_EXPIRED`/`UNAUTHENTICATED` |
| | `POST /auth/logout` | 204 |
| NFTs | `GET /nfts?q&collections&networks&minPrice&maxPrice&tab&sort&page&pageSize` | 200 `CatalogPage` (itens, total, páginas, facetas e faixa de preço) · 503 |
| | `GET /nfts/:id` · `GET /nfts/:id/related` | 200 `NftDetail` / `NftSummary[]` · 404 `NOT_FOUND` |
| | `GET /highlights` · `GET /recommendations` | 200 |
| Favoritos | `GET /favorites` · `PUT /favorites/:nftId` · `DELETE /favorites/:nftId` | 200/204 · 401 · 404 · 500 |
| Carrinho | `GET /cart` (visitante via `X-Cart-Id`) | 200 `Cart` (itens, resumo, `changes`, versão) |
| | `POST /cart/items` `{nftId,editionId,quantity}` | 201 · 404 · 409 `EDITION_UNAVAILABLE`/`QUANTITY_LIMIT` · 422 |
| | `PATCH /cart/items/:id` `{quantity}` · `DELETE /cart/items/:id` | 200 · 409 `QUANTITY_LIMIT` |
| | `POST /cart/coupon` `{code}` · `DELETE /cart/coupon` | 200 · 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| | `POST /cart/acknowledge` | 200 (usuário reconhece os novos preços) |
| | `POST /cart/merge` `{guestCartId}` | 200 (mescla o carrinho do visitante ao autenticar) |
| Cotação | `POST /quotes` `{network}` | 201 `Quote` (linhas, subtotal, desconto, taxa, total, expiração de 5 min) · 409 `AVAILABILITY_CONFLICT` · 422 |
| Carteira (conexão) | `POST /wallet-connections` · `DELETE /wallet-connections/:id` | 201/204 · 409 `WALLET_REJECTED` |
| Pedidos | `POST /orders` + cabeçalho `Idempotency-Key` | 201/200 `Order` · 409 `QUOTE_CHANGED` (com a nova cotação), `QUOTE_EXPIRED`, `AVAILABILITY_CONFLICT`, `WALLET_NOT_CONNECTED`, `IDEMPOTENCY_CONFLICT` · 400 |
| | `GET /orders?status` · `GET /orders/:id` | 200 · 404 (pedido de outro usuário é tratado como inexistente) · 403 |
| Perfil | `GET/PUT /profile` · `POST/DELETE /profile/avatar` (multipart) · `POST /profile/password` | 200/204 · 409 conflito · 422 validação · 403 |
| Carteiras | `GET /wallets` · `PUT /wallets/:slot` (`primary`/`secondary`) · `DELETE /wallets/secondary` | 200/204 · 409 (secundária sem principal) · 422 |

### Idempotência de pedidos

- **Mesma tentativa, mesmo pedido.** A chave é gerada por tentativa (`crypto.randomUUID()`) e guardada em `sessionStorage` junto com o corpo. Repetir a mesma chave com o mesmo corpo (hash estável) devolve o mesmo pedido com 200.
- **Mesma chave, conteúdo diferente: conflito.** O servidor responde 409 `IDEMPOTENCY_CONFLICT`.
- **Timeout ou queda de rede.** O cliente reenvia automaticamente com a mesma chave. Se ainda assim falhar, mostra "Verificar novamente". Após um refresh, o checkout oferece "Retomar pedido", que reenvia a mesma tentativa.
- **Cliques repetidos.** O botão bloqueia, há uma trava em `ref` contra envios simultâneos e a chave continua a mesma.

### Ciclo do pedido

1. **Revalidação no envio.** Ao receber o pedido, o servidor confere preço, disponibilidade, cupom, versão do carrinho e validade da cotação. Qualquer divergência gera uma nova cotação, devolvida em `QUOTE_CHANGED`, e o usuário precisa confirmar de novo.
2. **Pedido pendente.** Com tudo válido, o pedido nasce `pending` e o estoque fica reservado (com `nft.updated`).
3. **Liquidação.** Depois de `settleDelayMs`, o pedido vira `confirmed` ou `declined`:
   - **Confirmado:** o pedido recebe hash de transação e link de explorador simulados, e saem do carrinho apenas os itens e quantidades comprados.
   - **Recusado:** o estoque é devolvido e o carrinho fica intacto.
   - Pedidos confirmados ou recusados são terminais.
4. **Recibo.** O recibo é o snapshot imutável da cotação no momento do pedido. Mudanças posteriores no catálogo não o afetam.
5. **Persistência.** Pedidos pendentes sobrevivem ao refresh: o horário de liquidação é persistido e os timers são retomados ao iniciar.

## Eventos (Socket.IO)

Todo evento tem `{ id, type, resource: { type, id }, version, occurredAt, data }`.

| Evento | Dados | Destino |
| --- | --- | --- |
| `nft.updated` | `price`, `previousPrice`, `available`, `editions[{id,price,available}]` | Todos os sockets |
| `order.updated` | `userId`, `status`, `transactionHash`, `explorerUrl`, `declineReason` | Somente sockets autenticados como o dono do pedido |
| `session.ready` | `userId` | Confirma a autenticação do socket (via `auth.token` no CONNECT) |

### Como o cliente aplica os eventos (`features/realtime`)

- **Idempotência.** O cliente guarda um conjunto de ids já vistos e a versão máxima conhecida de cada recurso, considerando o cache e as respostas REST. Eventos duplicados ou com versão menor ou igual são descartados, então o estado nunca regride.
- **`nft.updated`:**
  - atualiza detalhe, listas do catálogo, relacionados, recomendações, destaque e favoritos;
  - se o NFT está no carrinho, invalida o carrinho (o servidor recalcula resumo, limites e `changes`) e avisa o usuário (toast com `aria-live`).
- **`order.updated`:**
  - é aplicado só se `data.userId` for o usuário atual e o pedido ainda estiver pendente;
  - atualiza o pedido em cache e invalida pedidos e carrinho.
- **Reconciliação após reconexão.** No `connect` seguinte à primeira conexão, catálogo, carrinho e pedidos ativos são invalidados e buscados de novo pela API REST. A página do pedido pendente também consulta o status a cada 3 s se o socket cair, ou a cada 8 s com ele conectado.
- **Ciclo de vida.**
  - Há um socket por token. Logout ou troca de usuário encerram o socket anterior e removem todos os listeners.
  - O cache privado (`['user', ...]`) e a memória de eventos são limpos.
  - O servidor só envia `order.updated` ao dono.

### Transporte e limitações no ambiente de mocks

- **Interceptação.** O MSW intercepta o WebSocket com `ws.link` e o `@mswjs/socket.io-binding` codifica e decodifica o protocolo Engine.IO/Socket.IO. O cliente real (`socket.io-client`) conecta normalmente.
- **Só WebSocket.** O cliente usa `transports: ['websocket']`, porque o long-polling HTTP do Engine.IO não é suportado pelo binding.
- **Ordem de carregamento.** O `engine.io-client` captura o construtor global de `WebSocket` ao ser avaliado. Por isso o módulo do socket é carregado sob demanda, depois que os mocks instalam o interceptador (`app/mocks-ready.ts`).
- **Link na raiz.** O MSW remove o prefixo `/socket.io/` antes de comparar URLs, então o link é registrado na raiz da origem. Outras conexões (ex.: HMR do Vite) são repassadas ao servidor real.
- **Heartbeat.** O binding não envia PING. O servidor simulado manda um PING a cada 20 s para o cliente não encerrar por `pingTimeout`.
- **Recursos ausentes.** O binding não implementa namespaces, salas ou broadcast; o roteamento por usuário é feito no servidor simulado.

## Mocks (MSW)

- **Escopo.** Os handlers são a única fonte de dados. Componentes, hooks e o cliente Axios não têm respostas fixas nem caminhos alternativos.
- **Estado consistente.** O banco simulado (`mocks/db.ts`) mantém catálogo, usuários, sessões, carrinhos, favoritos, carteiras, cotações, pedidos, chaves de idempotência e eventos, persistido em `localStorage` para sustentar o refresh. O reset restaura o seed determinístico.
- **Fixtures.**
  - 239 NFTs, com as contagens por coleção do layout e preços de 0,02 a 12,30 ETH;
  - primeira página igual ao Figma;
  - edições 1/1, 1/10, 1/50 e ABERTA, com esgotadas determinísticas;
  - 2 usuários e 3 cupons.
- **Cenários e latência.** Ficam em `mocks/scenarios.ts`. A latência é pseudoaleatória com seed por requisição, portanto reproduzível.
- **Controle.** Os endpoints `/api/__mock/*` (reset, configuração, alteração de NFT com emissão de `nft.updated`, expiração de sessões, queda de sockets, reenvio de eventos, liquidação de pedidos) são usados pelo painel e pelos testes. Eles alteram o "backend"; a interface só recebe as mudanças por REST e Socket.IO.
- **Ativação.** É controlada por `VITE_ENABLE_MOCKS` e fica ativa no build de demonstração.
- **Cookies.** O pacote `tough-cookie` é substituído por um shim (`mocks/shims`), porque a API usa Bearer e não cookies. Isso economiza cerca de 60 KB gzip. Limitação: os mocks não persistem `Set-Cookie`.

## Sessão

- **Login e cadastro.** Retornam token opaco e expiração (30 min), guardados em `localStorage` (`kurio:session`) e sincronizados entre abas. A senha nunca é guardada no cliente; no servidor simulado fica apenas o hash SHA-256 com salt.
- **Refresh.** `GET /auth/session` valida a sessão persistida.
- **Expiração (401):**
  - em rotas privadas (checkout, pedido, conta), o usuário vai para `/entrar?redirect=<rota>&motivo=expirada` e volta ao mesmo ponto depois de entrar;
  - em rotas públicas, recebe apenas um aviso.
- **Checkout.** O rascunho do formulário fica em `sessionStorage`, por usuário, e é restaurado após o novo login.
- **Logout e troca de usuário.** Removem o cache privado e a memória de eventos, encerram o socket e criam um novo carrinho de visitante.
- **Guardas.** Rotas privadas usam `beforeLoad` com redirecionamento. Destinos de retorno só aceitam caminhos internos (proteção contra open redirect).

## Carrinho

- **Servidor como fonte.** O carrinho fica no servidor simulado, tanto para usuários quanto para visitantes (id em `localStorage`, enviado em `X-Cart-Id`). Por isso sobrevive ao refresh e é mesclado ao carrinho do usuário no login (`POST /cart/merge`), respeitando os limites.
- **Limites.** Valem a disponibilidade de cada edição e o máximo de 10 por pedido. A interface limita o stepper e o servidor responde `QUANTITY_LIMIT`.
- **Alterações em tempo real.** O servidor compara o preço reconhecido de cada linha com o atual e a quantidade com o estoque, e devolve `changes`. A interface mostra o aviso e bloqueia o checkout enquanto houver quantidade acima do disponível.
- **Atualização otimista (com rollback).** Duas interações usam:
  - quantidade no carrinho;
  - favoritos, com rollback e ação "Tentar novamente".
- **Ordem das mutations.** As mutations do carrinho rodam em série (`scope`) para evitar respostas fora de ordem.

## Estratégia de cache, retries e sincronização

| Aspecto | Política |
| --- | --- |
| `staleTime` | 30 s padrão · carrinho 10 s · destaques 5 min · sessão 5 min |
| Retries de consulta | Até 2, só para falhas transitórias (rede, timeout, 5xx), com backoff exponencial (500 ms → 4 s). 4xx não repete. |
| Mutations | Sem retry automático (evita duplicar operações). Pedidos usam idempotência e reenvio explícito. |
| Chaves | Catálogo chaveado pelos parâmetros da consulta. Dados privados em `['user', userId, ...]`, isolando usuários e visitante. |
| Respostas obsoletas | Cada consulta recebe `AbortSignal` (cancelada ao trocar de chave). `keepPreviousData` mantém a página anterior durante a atualização, com indicação visual e `aria-busy`. Respostas antigas nunca sobrescrevem outra chave. |
| Invalidação | Após mutations (carrinho, favoritos, pedidos), eventos (`nft.updated` → carrinho; `order.updated` → pedido, pedidos e carrinho) e reconexão. |
| Foco da janela | `refetchOnWindowFocus` ativo |

## Desempenho

- **Divisão de código.** O código é dividido por rota (checkout, conta, auth e pedido sob demanda). Início e detalhe ficam no bundle principal, que recebe `modulepreload`.
- **Carregamento em paralelo.** A interface renderiza em paralelo à inicialização dos mocks, e o Axios aguarda o sinal de prontos. Um shell estático no `index.html` garante o primeiro paint, e o service worker do MSW é registrado já no HTML.
- **Assets.** Artes em WebP responsivo (160 a 960 px, geradas das imagens do Figma: de 8 MB para 392 KB), com `srcset`/`sizes`, dimensões explícitas e `preload` da arte principal. Fontes servidas localmente com `preload` e `font-display: swap`.
- **Movimento.** Skeletons com shimmer que preservam as dimensões (CLS ≤ 0,02) e respeitam `prefers-reduced-motion`.

### Resultados Lighthouse

Medianas de 3 execuções; detalhes em `lighthouse/reports`.

| Página | Perfil | Perf. | A11y | BP | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | 65 | 100 | 100 | 100 | 4,04 s | 0,019 | 772 ms |
| Início | desktop | 98 | 100 | 100 | 100 | 0,96 s | 0,005 | 46 ms |
| Detalhe | mobile | 67 | 100 | 100 | 100 | 4,03 s | 0,000 | 751 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 0,94 s | 0,000 | 20 ms |

**Abaixo da meta: Performance mobile (65 e 67).** Causas identificadas nos traces:

1. **O backend roda no navegador.** No perfil mobile (4G lento simulado, CPU 4× mais lenta), a camada MSW obrigatória no build de demonstração precisa:
   - baixar e avaliar cerca de 55 KB gzip;
   - registrar e ativar um service worker num perfil sempre "frio";
   - montar o banco simulado;
   - executar os handlers na thread principal.

   Além disso, todo request (incluindo imagens e fontes) passa pelo service worker, que consulta a página antes de liberar. Isso aparece como cerca de 1 s de script atribuído ao chunk dos mocks e explica a maior parte do TBT.
2. **O elemento de LCP depende de dados.** No mobile, o LCP é a primeira arte do catálogo, que só pode ser exibida depois da cadeia JS → mocks prontos → `GET /nfts` → imagem. O atraso de carregamento do recurso é de cerca de 1,9 s nesse modelo.
3. **Aplicação SPA sem SSR.** Cerca de 230 KB gzip de JavaScript da aplicação (React, Router, Query, Axios, Radix) precisam ser avaliados antes da renderização.

No desktop as mesmas páginas ficam em 98 e 99, e o mesmo build medido com throttling aplicado (DevTools) tem FCP em cerca de 2 s. Com um backend real, os itens 1 e 2 deixam de existir. A auditoria carrega imagens, fontes e funcionalidades completas, sem simplificações exclusivas para pontuar.

## Decisões de UX e desvios do Figma

O Figma define a identidade e a composição. Os pontos abaixo complementam estados não desenhados ou interpretam campos ambíguos.

**Componentes e páginas**

- **Cabeçalho autenticado.** O botão "Entrar" vira o menu da conta (nome ou avatar, com perfil, carteiras, lista de interesse e sair). O Figma só mostra o estado deslogado.
- **Badge do carrinho.** Mostra o número de linhas do carrinho (no layout, o número é ilustrativo).
- **Ações do card.** As ações (carrinho, favoritar, ver) aparecem no hover ou foco, como no frame de login, e ficam sempre visíveis em telas sem hover.
- **Galeria do detalhe.** O arquivo traz uma arte por NFT (as miniaturas do Figma são idênticas). A galeria mostra enquadramentos diferentes da mesma obra, com zoom em diálogo. A aba "Avaliações" exibe avaliações vindas da API.
- **Hero.** Carrossel manual de 3 destaques vindos da API, sem autoplay (acessibilidade). Os slides 2 e 3 usam o mesmo padrão visual do 1º.
- **Login e cadastro.** No desktop são um modal sobre a página inicial, como no layout. No mobile, tela cheia. Fechar o modal volta ao fluxo anterior.

**Checkout e pedidos**

- **Campos interpretados.**
  - "Tipo de carteira" escolhe uma carteira cadastrada (principal ou secundária) e preenche endereço, rede e provedor.
  - "Usar outra carteira?" libera o endereço manual.
  - A lista "Carteira e rede" escolhe o provedor para a conexão simulada.
  - No campo "Nome ENS" foi adicionado o input do nome ao lado do sufixo.
- **Revisão antes do envio.** Um diálogo de revisão (itens, cotação, conexão da carteira) foi adicionado antes do envio. Ele atende à exigência de revisão e de conexão, recusa e desconexão simuladas.
- **Checkout mobile.** Segue o frame "Pagamento com carteira". Os dados do colecionador ficam numa seção recolhível, pré-preenchida pelo perfil.
- **Estados não desenhados.** Pedido pendente e recusado, carrinho vazio, erros, 404, skeletons e avisos de alteração de preço seguem o padrão visual do projeto.

**Escopo e infraestrutura**

- **Ações fora do escopo.** Criadores, Aprenda, Diário, Atividade, Ofertas, Arquivos, Suporte, recuperação de senha, login social e newsletter informam que não estão disponíveis, sem simular sucesso. Links de redes sociais e de compartilhamento abrem os sites reais em nova aba. "Ver no Etherscan" abre um link de explorador de testnet com o hash simulado.
- **Conta no mobile e tablet.** Não há frame. O menu lateral vira uma lista horizontal rolável, e os formulários ficam em uma coluna.
- **Responsividade.** Tablet (768 px) usa o layout desktop com filtros em gaveta. Abaixo de 768 px vale o layout mobile do Figma (desenhado em 414 px e validado em 390 px).
- **Toasts e painel de mocks.** Não existem no layout. Os toasts dão feedback acessível de mutations e eventos; o painel atende ao requisito de cenários configuráveis e pode ser desativado com `VITE_MOCK_PANEL=false`.

### Assets

- **Origem.** Artes, ícones e o formato da tab bar foram exportados do arquivo Figma pela API REST. A exportação bruta fica em `design/`, que não é versionada; os assets derivados (`public/nfts`, `src/components/icons`) estão no repositório, então a aplicação não depende dela.
- **Conversões.** As artes foram convertidas para WebP; os ícones viraram componentes React com `currentColor` (logos de marca mantêm as cores).
- **Ignorados.** Duas imagens do arquivo sem relação com as telas foram descartadas.
- **Fontes.** Roboto Mono (fonte única do layout), servida localmente a partir do `@fontsource` (latin 400/500/700).

### Acessibilidade

- **Estrutura.** Link "Pular para o conteúdo", landmarks e headings em ordem.
- **Foco.** Visível em todos os elementos interativos, controlado em diálogos e gavetas (Radix, com retorno ao gatilho).
- **Formulários.** Labels associados, `aria-invalid` e `aria-describedby` com as mensagens de erro, inclusive as vindas da API. Asterisco de obrigatório acompanhado de texto para leitores de tela.
- **Feedback.** Estados não dependem só de cor: edição esgotada é riscada e marcada como "esgotada", página atual usa `aria-current`, favorito usa `aria-pressed`. Mutations e eventos anunciam por `aria-live`.
- **Tamanho de alvos.** Os indicadores do carrossel ganharam área de toque de 24 px (o layout desenha pontos de 7 px).
- **Contraste.** As cores do layout foram mantidas; todas atingem o contraste exigido (Lighthouse Accessibility 100).

## Limitações conhecidas

- **Persistência local.** O banco simulado fica no `localStorage` de cada navegador. Abas compartilham os dados, mas não há sincronização entre dispositivos.
- **Socket.IO simulado.** Suporta apenas o transporte WebSocket e o namespace padrão.
- **Cookies.** Os mocks não simulam cookies (veja Mocks).
- **Cotação.** É válida por 5 minutos, e taxas de rede são fixas por rede (0,016 / 0,002 / 0,001 ETH).
