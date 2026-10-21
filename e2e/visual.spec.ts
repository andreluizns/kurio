import type { Page } from '@playwright/test'
import { expect, login, test } from './fixtures'

/**
 * Regressão visual com baselines versionadas (e2e/__screenshots__).
 * Dados estáveis: fixtures determinísticas, mocks resetados, toasts ocultos e imagens carregadas.
 */
async function stabilize(page: Page) {
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important} *{caret-color:transparent!important}' })
  await page.evaluate(async () => {
    for (const img of Array.from(document.images)) img.loading = 'eager'
    await Promise.all(
      Array.from(document.images).map((img) => (img.complete ? Promise.resolve() : new Promise((r) => img.addEventListener('load', r, { once: true })))),
    )
    await document.fonts.ready
  })
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
}

test.describe('Regressão visual', () => {
  test('início', async ({ page, mock }) => {
    void mock
    await page.goto('/')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
    await stabilize(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe do NFT', async ({ page, mock }) => {
    void mock
    await page.goto('/nft/nft-emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('carrinho', async ({ page, mock }) => {
    void mock
    await login(page, 'ana', '/carrinho')
    await expect(page.getByTestId('summary-total')).toHaveText('26.846 ETH')
    await stabilize(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento', async ({ page, mock }) => {
    void mock
    await login(page, 'ana', '/pagamento')
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    await stabilize(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
  })
})
