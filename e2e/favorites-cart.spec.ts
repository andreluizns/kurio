import { expect, login, test } from './fixtures'

test.describe('4. Favoritos', () => {
  test('favoritar persiste para o usuário; falha de mutation faz rollback e permite nova tentativa', async ({ page, mock, isMobile }) => {
    await login(page, 'ana', '/nft/nft-ivory-baron-088')
    const toggle = isMobile ? page.getByRole('button', { name: 'Adicionar à lista de interesse' }) : page.getByRole('button', { name: 'Favoritar', exact: true })

    // Falha: estado otimista é revertido.
    await mock.scenarios('favorites-error')
    await toggle.click()
    await expect(page.getByText('Não foi possível favoritar Ivory Baron #088.')).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    // Recuperação: cenário removido, nova tentativa pela ação do aviso.
    await mock.scenarios()
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByText('Ivory Baron #088 adicionado à lista de interesse.')).toBeVisible()

    await page.reload()
    const pressed = isMobile ? page.getByRole('button', { name: 'Remover da lista de interesse' }) : page.getByRole('button', { name: 'Favorito', exact: true })
    await expect(pressed).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/conta/favoritos')
    await expect(page.getByTestId('favorites-grid')).toContainText('Ivory Baron #088')
  })

  test('visitante é levado ao login ao favoritar', async ({ page, mock, isMobile }) => {
    void mock
    await page.goto('/nft/nft-ivory-baron-088')
    await (isMobile ? page.getByRole('button', { name: 'Adicionar à lista de interesse' }) : page.getByRole('button', { name: 'Favoritar', exact: true })).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Fnft-ivory-baron-088/)
  })
})

test.describe('5. Carrinho', () => {
  test('quantidades, remoção, cupom inválido/expirado/válido e resumo coerente', async ({ page, mock, isMobile }) => {
    void mock
    await login(page, 'ana', '/carrinho')
    await expect(page.getByTestId('summary-total')).toHaveText('26.846 ETH')

    // Remove o Ivory Baron (16.11) → subtotal 10.72.
    await page.getByRole('button', { name: 'Remover Ivory Baron #088 do carrinho' }).click()
    await expect(page.getByTestId('summary-subtotal')).toHaveText('10.72 ETH')

    // Aumenta Emerald Ape para 3 → +1.19.
    const emerald = page.getByTestId('cart-items').getByRole('listitem').filter({ hasText: 'Emerald Ape #042' })
    await emerald.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(emerald.locator('output')).toHaveText('3')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('11.91 ETH')

    const code = page.getByRole('textbox', { name: 'Código promocional' })
    await code.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Código promocional inválido.' })).toBeVisible()
    await code.fill('VERAO2025')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Este código promocional expirou.' })).toBeVisible()
    await code.fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('KURIO10')).toBeVisible()
    // 10% de 11.91 = 1.191 → total 11.91 - 1.191 + 0.016 = 10.735
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 1.191 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('10.735 ETH')

    // Persistência após refresh.
    await page.reload()
    await expect(page.getByTestId('summary-total')).toHaveText('10.735 ETH')
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 00.00')
    void isMobile
  })

  test('carrinho do visitante persiste no refresh e é preservado ao autenticar', async ({ page, mock, isMobile }) => {
    void mock
    await page.goto('/nft/nft-golden-signal-160')
    await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(page.getByTestId('cart-items').getByRole('listitem')).toHaveCount(1)
    await page.reload()
    await expect(page.getByTestId('cart-items')).toContainText('Golden Signal #160')

    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
    await page.getByPlaceholder('contato@email.com').fill('ana@kurio.dev')
    await page.getByPlaceholder('Senha', { exact: true }).fill('Kurio@2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/pagamento$/)
    await page.goto('/carrinho')
    // 3 itens da Ana + 1 do visitante.
    await expect(page.getByTestId('cart-items').getByRole('listitem')).toHaveCount(4)
    await expect(page.getByTestId('cart-items')).toContainText('Golden Signal #160')
  })

  test('limite de disponibilidade por edição é respeitado', async ({ page, mock, isMobile }) => {
    await login(page, 'ana', '/carrinho')
    // Restam 7 unidades da edição do Ivory Baron (9 no carrinho).
    await mock.updateNft('nft-ivory-baron-088', { available: 7 })
    await expect(page.getByTestId('cart-changes')).toContainText('restam 7 unidade(s)')
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
    const ivory = page.getByTestId('cart-items').getByRole('listitem').filter({ hasText: 'Ivory Baron #088' })
    await expect(ivory.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
    void isMobile
  })
})
