import { expect, test } from './fixtures'

type Page = import('@playwright/test').Page
const cards = (page: Page) => page.getByTestId('catalog-grid').getByTestId('nft-card')
/** Facetas usam checkbox visualmente oculto dentro do label (o label é o alvo clicável). */
/** Aguarda a grade sair da atualização em segundo plano (dados da consulta atual). */
const settled = (page: Page) => expect(page.getByTestId('catalog-grid')).toHaveAttribute('aria-busy', 'false')
const facet = (page: Page, name: string) => page.locator('label').filter({ hasText: name }).first()

test.describe('1. Catálogo: busca, filtros, ordenação, paginação e histórico', () => {
  test('filtros combinados, ordenação e paginação compõem a URL e sobrevivem ao refresh e ao histórico', async ({ page, mock, isMobile }) => {
    test.skip(isMobile, 'Filtros laterais são do layout desktop; o mobile é coberto abaixo.')
    void mock
    await page.goto('/')
    await expect(cards(page)).toHaveCount(9)
    await expect(cards(page).first()).toContainText('Emerald Ape #042')

    // Coleção + rede (combináveis).
    await facet(page, 'Música').click()
    await expect(page).toHaveURL(/collections=musica/)
    await facet(page, 'Solana').click()
    await expect(page).toHaveURL(/collections=musica.*networks=solana|networks=solana.*collections=musica/)
    await expect(cards(page).first()).toContainText('Golden Beat #207')

    // Ordenação por menor preço.
    await page.getByTestId('sort-trigger').click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=menor-preco/)
    await settled(page)
    const prices = await cards(page).locator('p').allInnerTexts()
    const values = prices.map((p) => Number.parseFloat(p))
    expect([...values].sort((a, b) => a - b)).toEqual(values)

    // Paginação.
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    await settled(page)
    const page2First = await cards(page).first().locator('h3').innerText()

    // Mudança de filtro reinicia a paginação.
    await facet(page, 'Polygon').click()
    await expect(page).not.toHaveURL(/page=2/)

    // Histórico: volta para a página 2 com os mesmos resultados.
    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(cards(page).first().locator('h3')).toHaveText(page2First)

    // Refresh preserva o estado da URL.
    await page.reload()
    await expect(page.getByRole('checkbox', { name: /Música/ })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /Solana/ })).toBeChecked()
    await expect(cards(page).first().locator('h3')).toHaveText(page2First)
  })

  test('busca por texto, resultado vazio e limpeza de filtros', async ({ page, mock, isMobile }) => {
    void mock
    await page.goto('/')
    if (isMobile) {
      await page.getByRole('searchbox', { name: 'Explorar coleções' }).fill('golden')
      await page.getByRole('searchbox', { name: 'Explorar coleções' }).press('Enter')
    } else {
      await page.getByRole('button', { name: 'Buscar NFTs' }).click()
      await page.getByRole('searchbox', { name: 'Termo de busca' }).fill('golden')
      await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    }
    await expect(page).toHaveURL(/q=golden/)
    await expect(cards(page).first()).toContainText(/Golden/)
    // A busca considera nome, coleção e token: todos os resultados pertencem a “Golden…”.
    expect(await cards(page).count()).toBeGreaterThan(0)

    await page.goto('/?q=inexistente-xyz')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await expect(cards(page)).toHaveCount(9)
  })

  test('cenário de catálogo vazio exibe estado vazio', async ({ page, mock }) => {
    await mock.scenarios('empty-catalog')
    await page.goto('/')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
  })
})

test.describe('2. Detalhe do NFT: acesso direto e recurso inexistente', () => {
  test('acesso direto ao detalhe exibe dados, edições e limite de quantidade', async ({ page, mock, isMobile }) => {
    void mock
    await page.goto('/nft/nft-emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '1/50' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('1.19 ETH').first()).toBeVisible()

    // Limite: máximo por pedido (10) — o botão de aumentar desabilita no limite.
    const plus = page.getByRole('button', { name: 'Aumentar quantidade' })
    for (let i = 0; i < 12; i++) if (await plus.isEnabled()) await plus.click()
    await expect(page.getByRole('group', { name: 'Quantidade' }).locator('output')).toHaveText('10')
    await expect(plus).toBeDisabled()

    // Troca de edição atualiza o preço.
    await page.getByRole('radio', { name: '1/10' }).click()
    await expect(page.getByText(/1\.785 ETH/).first()).toBeVisible()
    void isMobile
  })

  test('edição esgotada fica indisponível', async ({ page, mock }) => {
    // Sage Nomad #009 tem a edição 1/1 esgotada nas fixtures.
    void mock
    await page.goto('/nft/nft-sage-nomad-009')
    const soldOut = page.getByTitle('Edição 1/1 esgotada')
    await expect(soldOut).toBeDisabled()
    await expect(soldOut).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTitle('Edição 1/50')).toHaveAttribute('aria-checked', 'true')
  })

  test('NFT inexistente mostra 404 e rota desconhecida mostra página não encontrada', async ({ page, mock }) => {
    void mock
    await page.goto('/nft/nao-existe')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })
})
