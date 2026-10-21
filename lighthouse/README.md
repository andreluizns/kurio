# Auditoria Lighthouse

- **Configuração:** [`config.mjs`](config.mjs). Páginas Início (`/`) e Detalhe (`/nft/nft-emerald-ape-042`), perfis mobile (padrão do Lighthouse: Moto G Power, 4G lento e CPU 4× com throttling simulado) e desktop (preset oficial), 4 categorias.
- **Execução:** [`run.mjs`](run.mjs). Faz 3 medições por página e perfil, cada uma num navegador novo (sem cache nem service worker anterior), e calcula a mediana de cada categoria e das métricas LCP, CLS, TBT e FCP.
- **Relatórios:** `reports/<pagina>-<perfil>-<n>.html|json`, `reports/summary.md` (tabela) e `reports/summary.json` (versões, ambiente e todas as execuções).

## Como executar

```bash
pnpm build
pnpm preview            # http://localhost:4173, build otimizado com o cenário padrão dos mocks
pnpm lighthouse         # em outro terminal
```

As variáveis `LH_BASE_URL`, `LH_RUNS` e `CHROME_PATH` alteram o destino, o número de medições e o navegador. Por padrão o navegador é o Chromium do Playwright, para que o ambiente seja reprodutível.

## Ambiente da última execução

Lighthouse 13.5.0 · chrome-launcher 1.2.2 · Chromium do Playwright 1.64.1 (build 1248) · Node 24.22.0 · Linux 6.8 x64 · Intel Core i7-7500U.

Resultados, metas e a justificativa dos itens abaixo da meta estão em [`reports/summary.md`](reports/summary.md) e na seção "Desempenho" do [ARCHITECTURE.md](../ARCHITECTURE.md).
