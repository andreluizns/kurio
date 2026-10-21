import { expect, login, test, USERS } from './fixtures'

// PNG 1×1 válido.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('8. Perfil, avatar, senha e carteiras', () => {
  test('edição do perfil com validação e conflito; alterações persistem', async ({ page, mock }) => {
    void mock
    await login(page, 'ana', '/conta/perfil')
    const display = page.getByLabel('Nome de exibição')
    await expect(display).toHaveValue('Ana Sato')

    await display.fill('')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Informe o nome de exibição.')).toBeVisible()
    await expect(display).toHaveAttribute('aria-invalid', 'true')

    // Conflito vindo da API.
    await display.fill('Ana S.')
    await page.getByLabel('Nome de usuário').fill('bruno.lima')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()

    await page.getByLabel('Nome de usuário').fill('ana.s')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil atualizado.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana S.')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('ana.s')
  })

  test('avatar: envio, formato inválido e remoção', async ({ page, mock }) => {
    void mock
    await login(page, 'ana', '/conta/perfil')
    await page.getByTestId('avatar-input').setInputFiles({ name: 'avatar.gif', mimeType: 'image/gif', buffer: PNG })
    await expect(page.getByText('Use PNG, JPG ou WebP.')).toBeVisible()
    await page.getByTestId('avatar-input').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('img', { name: 'Avatar de Ana Sato' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: 'Avatar de Ana Sato' })).toBeVisible()
    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByRole('img', { name: 'Avatar de Ana Sato' })).toHaveCount(0)
  })

  test('alteração de senha com erro da API e login com a nova senha', async ({ page, mock, isMobile }) => {
    void mock
    await login(page, 'ana', '/conta/perfil')
    await page.getByLabel('Senha atual').fill('senha-errada1')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha2026')
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha2026')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha atual incorreta.').first()).toBeVisible()

    await page.getByLabel('Senha atual').fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil e senha atualizados.')).toBeVisible()

    if (isMobile) await page.getByRole('button', { name: 'Sair' }).click()
    else {
      await page.getByRole('button', { name: /Conta de/ }).click()
      await page.getByRole('menuitem', { name: 'Sair' }).click()
    }
    // Aguarda o encerramento da sessão antes de navegar.
    await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible()
    await page.goto('/entrar')
    await page.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill('NovaSenha2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('carteiras: validação e cadastro da secundária, persistência após refresh', async ({ page, mock }) => {
    void mock
    await login(page, 'bruno', '/conta/carteiras')
    await expect(page.getByText('Você ainda não adicionou uma carteira secundária.')).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar' }).click()
    const form = page.getByTestId('secondary-form')
    await form.getByLabel('Apelido da carteira').fill('Reserva fria')
    await form.getByLabel('Rede').selectOption('polygon')
    await form.getByLabel('Nome do perfil').fill('bruno-cold')
    await form.getByLabel('Endereço da carteira').fill('0x123')
    await form.getByLabel('Tipo de carteira').selectOption('coinbase')
    await form.getByLabel('Código de indicação').fill('KURIO-B2')
    await form.getByLabel('Nome ENS').fill('brunocold')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText('Informe um endereço 0x com 40 caracteres hexadecimais.')).toBeVisible()

    await form.getByLabel('Endereço da carteira').fill('0x1111111111111111111111111111111111111111')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva.')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('secondary-form').getByLabel('Apelido da carteira')).toHaveValue('Reserva fria')
    await expect(page.getByTestId('secondary-form').getByLabel('Rede')).toHaveValue('polygon')
  })
})
