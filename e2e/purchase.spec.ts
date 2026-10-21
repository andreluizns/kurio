import { expect, login, test, waitForRealtime } from './fixtures'

test.describe('Compra completa', () => {
  test('do catálogo ao recibo confirmado', async ({ page, mock, isMobile }) => {
    await login(page, 'ana', '/carrinho')
    const items = page.getByTestId('cart-items')
    await expect(items.getByRole('listitem')).toHaveCount(3)
    await expect(page.getByTestId('summary-total')).toHaveText('26.846 ETH')

    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/pagamento$/)
    await waitForRealtime(mock, 'usr_ana')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
    await expect(dialog.getByTestId('review-total')).toHaveText('26.846 ETH')
    await dialog.getByRole('button', { name: /Conectar MetaMask/ }).click()
    await expect(dialog.getByText('Carteira conectada')).toBeVisible()
    await dialog.getByTestId('confirm-payment').click()

    await expect(page).toHaveURL(/\/pedido\//)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('26.846 ETH')
    await expect(page.getByTestId('receipt-tx')).toHaveText(/^0x/)
    void isMobile
  })
})
