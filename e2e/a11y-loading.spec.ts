import { expect, test } from './fixtures'

test.describe('11. Teclado, foco em diálogos e validação de formulários', () => {
  test('link de pular conteúdo e navegação por teclado no catálogo', async ({ page, mock, isMobile }) => {
    void mock
    await page.goto('/')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card').first()).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#conteudo$/)
    if (!isMobile) {
      // O nome do card é um link alcançável por teclado.
      const firstLink = page.getByRole('link', { name: 'Emerald Ape #042', exact: true })
      await firstLink.focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/nft\/nft-emerald-ape-042/)
    }
  })

  test('diálogo de login prende o foco e fecha com Esc; erros ficam associados aos campos', async ({ page, mock, isMobile }) => {
    test.skip(isMobile, 'No mobile o login é uma página, não um diálogo.')
    void mock
    await page.goto('/entrar?redirect=%2Fcarrinho')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Foco circula apenas dentro do diálogo.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }

    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = dialog.getByPlaceholder('contato@email.com')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    await expect(page.locator(`#${describedBy}`)).toHaveText('Informe seu e-mail.')

    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/carrinho$/)
  })

  test('diálogo de busca devolve o foco ao gatilho', async ({ page, mock, isMobile }) => {
    test.skip(isMobile, 'Gatilho de busca do cabeçalho desktop.')
    void mock
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('searchbox', { name: 'Termo de busca' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  })
})

test.describe('12. Skeletons em carregamento lento, falha e recuperação', () => {
  test('skeletons durante carregamento lento sem deslocamento de layout', async ({ page, mock }) => {
    await mock.scenarios('slow')
    await page.goto('/')
    const skeletons = page.getByTestId('nft-card-skeleton')
    await expect(skeletons.first()).toBeVisible()
    await expect(page.getByLabel('Carregando NFTs')).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9, { timeout: 15_000 })
    await expect(skeletons).toHaveCount(0)

    await page.goto('/nft/nft-emerald-ape-042')
    await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 15_000 })
  })

  test('falha no catálogo exibe feedback e recupera após nova tentativa', async ({ page, mock }) => {
    await mock.scenarios('catalog-error')
    await page.goto('/')
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo' })
    await expect(alert).toBeVisible({ timeout: 15_000 })
    await expect(alert).toContainText('temporariamente indisponível')

    await mock.scenarios()
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
  })

  test('sem conexão: mensagem de rede e recuperação', async ({ page, mock }) => {
    await mock.scenarios('offline')
    await page.goto('/nft/nft-emerald-ape-042')
    await expect(page.getByText('Sem conexão com o servidor')).toBeVisible({ timeout: 15_000 })
    await mock.scenarios()
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })
})
