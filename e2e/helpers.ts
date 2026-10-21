import { expect, type Page } from '@playwright/test'

/** Pedidos do usuário logado, consultados pela API (handlers MSW) dentro da página. */
export async function listOrders(page: Page) {
  return page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('kurio:session') ?? 'null') as { token: string } | null
    const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${session?.token}` } })
    return (await res.json()) as { id: string; status: string }[]
  })
}

/** Do carrinho à revisão do pedido com a carteira conectada. */
export async function openReviewAndConnect(page: Page) {
  await page.goto('/pagamento')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(dialog.getByTestId('review-total')).toBeVisible()
  await dialog.getByRole('button', { name: /^Conectar / }).click()
  await expect(dialog.getByText('Carteira conectada')).toBeVisible()
  return dialog
}
