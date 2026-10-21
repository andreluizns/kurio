import { expect, login, test, waitForRealtime } from './fixtures'
import { listOrders, openReviewAndConnect } from './helpers'

const EMERALD = 'nft-emerald-ape-042'
const EMERALD_1_50 = `${EMERALD}-1-50`

test.describe('9. Alteração de preço/disponibilidade via Socket.IO durante o checkout', () => {
  test('carrinho aberto recebe nft.updated, informa a alteração e atualiza o resumo', async ({ page, mock }) => {
    await login(page, 'ana', '/carrinho')
    await waitForRealtime(mock, 'usr_ana')
    await expect(page.getByTestId('summary-total')).toHaveText('26.846 ETH')

    // Evento emitido pelo servidor simulado e recebido pelo socket.io-client.
    await mock.updateNft(EMERALD, { editionId: EMERALD_1_50, priceDelta: '0.1' })
    await expect(page.getByText('Preço atualizado: Emerald Ape #042')).toBeVisible()
    await expect(page.getByTestId('cart-changes')).toContainText('preço de 1.19 ETH para 1.29 ETH')
    // 2 × 0.10 a mais no subtotal.
    await expect(page.getByTestId('summary-total')).toHaveText('27.046 ETH')
    await page.getByRole('button', { name: 'Entendi os novos preços' }).click()
    await expect(page.getByTestId('cart-changes')).toHaveCount(0)
  })

  test('checkout impede a confirmação com cotação desatualizada', async ({ page, mock }) => {
    await login(page, 'ana', '/carrinho')
    await waitForRealtime(mock, 'usr_ana')
    const dialog = await openReviewAndConnect(page)
    await expect(dialog.getByTestId('review-total')).toHaveText('26.846 ETH')

    await mock.updateNft(EMERALD, { editionId: EMERALD_1_50, priceDelta: '0.1' })
    await expect(dialog.getByTestId('quote-stale')).toBeVisible()
    await expect(dialog.getByTestId('confirm-payment')).toBeDisabled()

    await dialog.getByRole('button', { name: 'Atualizar cotação' }).click()
    await expect(dialog.getByTestId('review-total')).toHaveText('27.046 ETH')
    await expect(dialog.getByTestId('confirm-payment')).toBeEnabled()
    await dialog.getByTestId('confirm-payment').click()
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('27.046 ETH')
  })

  test('preço alterado no envio exige nova confirmação do usuário', async ({ page, mock }) => {
    await login(page, 'ana', '/carrinho')
    await mock.scenarios('price-change-on-checkout')
    const dialog = await openReviewAndConnect(page)
    await dialog.getByTestId('confirm-payment').click()
    await expect(dialog.getByTestId('quote-changed')).toContainText('de 26.846 ETH para 27.046 ETH')
    await expect(page).toHaveURL(/\/pagamento$/)
    await dialog.getByRole('button', { name: 'Confirmar novo total (27.046 ETH)' }).click()
    await expect(page).toHaveURL(/\/pedido\//)
    expect(await listOrders(page)).toHaveLength(1)
  })

  test('edição esgotada no envio bloqueia a compra e preserva o carrinho', async ({ page, mock }) => {
    await login(page, 'ana', '/carrinho')
    await mock.scenarios('sold-out-on-checkout')
    const dialog = await openReviewAndConnect(page)
    await dialog.getByTestId('confirm-payment').click()
    await expect(dialog.getByTestId('checkout-error')).toContainText('esgotaram')
    expect(await listOrders(page)).toHaveLength(0)
  })
})

test.describe('10. Eventos duplicados/antigos, desconexão e retomada de pedido pendente', () => {
  test('eventos duplicados e com versão antiga não regridem o estado', async ({ page, mock }) => {
    void mock
    await page.goto(`/nft/${EMERALD}`)
    await waitForRealtime(mock)
    const price = page.getByTestId('detail-price')
    await expect(price).toHaveText('1.19 ETH')

    await mock.updateNft(EMERALD, { editionId: EMERALD_1_50, price: '1.5' }) // versão 2
    await expect(price).toHaveText('1.50 ETH')
    await mock.updateNft(EMERALD, { editionId: EMERALD_1_50, price: '1.6' }) // versão 3
    await expect(price).toHaveText('1.60 ETH')

    await mock.replay('stale', 'nft.updated') // reenvia a versão 2 com novo id
    await mock.replay('duplicate', 'nft.updated') // reenvia o mesmo evento da versão 3
    await page.waitForTimeout(500)
    await expect(price).toHaveText('1.60 ETH')
  })

  test('queda de conexão com pedido pendente: reconexão e refresh recuperam o estado sem nova compra', async ({ page, mock }) => {
    await page.clock.install()
    await login(page, 'ana', '/carrinho')
    await mock.config({ settleDelayMs: 600_000 })
    const dialog = await openReviewAndConnect(page)
    await dialog.getByTestId('confirm-payment').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()

    // Servidor de tempo real fora do ar: o cliente tenta reconectar.
    await mock.scenarios('socket-offline')
    await mock.disconnectSockets()
    await expect(page.getByText('Reconectando ao tempo real')).toBeVisible()

    // O pedido é confirmado enquanto o socket está fora (evento perdido).
    await mock.settleOrders()

    // Recarregar durante a queda: o estado vem da API, sem criar outra compra.
    await page.reload()
    await mock.scenarios()
    await page.clock.fastForward('00:10')
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 15_000 })
    expect(await listOrders(page)).toHaveLength(1)
  })
})
