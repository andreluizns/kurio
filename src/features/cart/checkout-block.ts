import type { Cart } from '@/api/contracts'

/**
 * Motivo que impede seguir para o pagamento, ou null quando liberado.
 * Itens acima da disponibilidade precisam ser ajustados, e mudanças de preço recebidas em
 * tempo real precisam ser reconhecidas ("Entendi os novos preços") antes de continuar.
 */
export function checkoutBlockReason(cart: Cart | undefined): string | null {
  if (!cart || !cart.items.length) return null
  if (cart.items.some((i) => i.quantity > i.available)) return 'Ajuste os itens sem disponibilidade para continuar.'
  if (cart.changes.some((c) => c.kind === 'price')) return 'Confirme os novos preços em “Entendi os novos preços” para continuar.'
  return null
}
