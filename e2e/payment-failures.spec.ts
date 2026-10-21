import { expect, login, test, waitForRealtime } from './fixtures'
import { listOrders, openReviewAndConnect } from './helpers'

test.describe('7. Falhas de pagamento, clique repetido e timeout', () => {
  test('pagamento recusado preserva os itens no carrinho', async ({ page, mock }) => {
    await login(page, 'ana', '/carrinho')
    await waitForRealtime(mock, 'usr_ana')
    await mock.scenarios('payment-declined')
    const dialog = await openReviewAndConnect(page)
    await dialog.getByTestId('confirm-payment').click()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Pagamento recusado', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Ver carrinho' }).click()
    await expect(page.getByTestId('cart-items').getByRole('listitem')).toHaveCount(3)
  })

  test('cliques repetidos no pagamento criam um único pedido', async ({ page, mock }) => {
    await login(page, 'ana', '/carrinho')
    await mock.config({ settleDelayMs: 60_000 })
    const dialog = await openReviewAndConnect(page)
    const pay = dialog.getByTestId('confirm-payment')
    // Três cliques imediatos: o botão bloqueia e a chave de idempotência é a mesma.
    await pay.evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
      button.click()
    })
    await expect(page).toHaveURL(/\/pedido\//)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    expect(await listOrders(page)).toHaveLength(1)
  })

  test('timeout após a criação recupera o mesmo pedido pela idempotência', async ({ page, mock }) => {
    test.setTimeout(60_000)
    await login(page, 'ana', '/carrinho')
    await mock.scenarios('order-timeout')
    const dialog = await openReviewAndConnect(page)
    await dialog.getByTestId('confirm-payment').click()
    // O servidor cria o pedido e demora 12 s; o cliente expira em 8 s e reenvia com a mesma chave.
    await expect(page).toHaveURL(/\/pedido\//, { timeout: 20_000 })
    const orders = await listOrders(page)
    expect(orders).toHaveLength(1)
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 10_000 })
    // Após a confirmação, somente os itens comprados saem do carrinho.
    await page.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })

  test('recusa e desconexão da carteira exigem nova conexão', async ({ page, mock }) => {
    await login(page, 'ana', '/carrinho')
    await mock.scenarios('wallet-rejected')
    await page.goto('/pagamento')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
    await dialog.getByRole('button', { name: /^Conectar / }).click()
    await expect(dialog.getByTestId('checkout-error')).toContainText('Você recusou a conexão')
    await expect(dialog.getByTestId('confirm-payment')).toBeDisabled()

    await mock.scenarios('wallet-disconnect')
    await dialog.getByRole('button', { name: /^Conectar / }).click()
    await expect(dialog.getByText('Carteira conectada')).toBeVisible()
    await dialog.getByTestId('confirm-payment').click()
    await expect(dialog.getByTestId('checkout-error')).toContainText('Sua carteira foi desconectada')
    await dialog.getByRole('button', { name: /^Conectar / }).click()
    await dialog.getByTestId('confirm-payment').click()
    await expect(page).toHaveURL(/\/pedido\//)
  })
})
