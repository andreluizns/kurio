import { expect, login, test, USERS, waitForRealtime } from './fixtures'

test.describe('3. Conta e sessão', () => {
  test('cadastro com validação, conflito de e-mail e criação da conta', async ({ page, mock }) => {
    void mock
    await page.goto('/cadastro')
    await page.getByRole('button', { name: /Criar (conta|perfil)/ }).click()
    await expect(page.getByText('Informe seu e-mail.')).toBeVisible()

    await page.getByPlaceholder('Nome de usuário').fill('nova.colecionadora')
    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill('Senha1234')
    await page.getByPlaceholder('Confirmar senha').fill('Senha9999')
    await page.getByRole('button', { name: /Criar (conta|perfil)/ }).click()
    await expect(page.getByText('As senhas não coincidem.')).toBeVisible()

    await page.getByPlaceholder('Confirmar senha').fill('Senha1234')
    await page.getByRole('button', { name: /Criar (conta|perfil)/ }).click()
    // Conflito retornado pela API, associado ao campo.
    const email = page.getByPlaceholder('Digite seu e-mail', { exact: true })
    await expect(page.getByText('Já existe uma conta com este e-mail.')).toBeVisible()
    await expect(email).toHaveAttribute('aria-invalid', 'true')

    await email.fill('nova@kurio.dev')
    await page.getByRole('button', { name: /Criar (conta|perfil)/ }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Conta criada!')).toBeVisible()

    // A sessão sobrevive ao refresh.
    await page.reload()
    await page.goto('/conta/perfil')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('nova.colecionadora')
  })

  test('login com credenciais inválidas e retorno ao fluxo anterior', async ({ page, mock }) => {
    void mock
    await page.goto('/conta/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fconta%2Fcarteiras/)
    await page.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill('senha-errada1')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
    await page.getByPlaceholder('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/conta\/carteiras$/)
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  test('expiração da sessão pelo relógio durante a navegação preserva o destino', async ({ page, mock }) => {
    await page.clock.install()
    await page.reload()
    void mock
    await login(page, 'ana', '/conta/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Sato')

    // Sessão de 30 minutos: avança o relógio além do prazo.
    await page.clock.fastForward('31:00')
    await page.getByRole('link', { name: 'Carteiras' }).first().click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fconta%2Fcarteiras&motivo=expirada/)
    await expect(page.getByText('Sua sessão expirou. Entre novamente')).toBeVisible()

    await page.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/conta\/carteiras$/)
  })

  test('expiração durante o checkout preserva o rascunho do formulário', async ({ page, mock, isMobile }) => {
    await login(page, 'ana', '/pagamento')
    if (isMobile) await page.getByText('Dados do colecionador').click()
    const note = page.getByLabel('Observação do colecionador (opcional)')
    await note.fill('Entregar na carteira principal, por favor.')
    await mock.expireSessions()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    // A revisão pede cotação → 401 → login com retorno ao checkout.
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
    await page.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/pagamento$/)
    if (isMobile) await page.getByText('Dados do colecionador').click()
    await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('Entregar na carteira principal, por favor.')
  })

  test('logout e troca de usuário limpam dados privados e a assinatura em tempo real', async ({ page, mock, isMobile }) => {
    await login(page, 'ana', '/conta/favoritos')
    await expect(page.getByTestId('favorites-grid').getByTestId('nft-card')).toHaveCount(2)
    await waitForRealtime(mock, 'usr_ana')

    if (isMobile) {
      await page.getByRole('button', { name: 'Sair' }).click()
    } else {
      await page.getByRole('button', { name: /Conta de Ana/ }).click()
      await page.getByRole('menuitem', { name: 'Sair' }).click()
    }
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible()
    await page.goto('/conta/favoritos')
    await expect(page).toHaveURL(/\/entrar/)

    await page.getByPlaceholder('contato@email.com').fill(USERS.bruno.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill(USERS.bruno.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/conta\/favoritos$/)
    const grid = page.getByTestId('favorites-grid')
    await expect(grid.getByTestId('nft-card')).toHaveCount(1)
    await expect(grid).toContainText('Golden Beat #207')
    await expect(grid).not.toContainText('Emerald Ape')

    // Nenhum socket da sessão anterior permanece ativo.
    await expect.poll(async () => (await mock.state()).sockets.map((s) => s.userId)).not.toContain('usr_ana')
    await page.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })
})
