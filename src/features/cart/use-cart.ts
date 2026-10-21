import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AddCartItemRequest, Cart } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { GUEST, queryKeys } from '@/api/query-keys'
import { guestCart, useSession } from '@/features/auth/session-store'
import { mul } from '@/lib/money'

export function useCartOwner() {
  return useSession()?.user.id ?? GUEST
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: queryKeys.cart(owner),
    queryFn: async ({ signal }) => {
      const cart = await api.cart.get({ signal })
      // Visitante: guarda o id do carrinho para mantê-lo após refresh e mesclá-lo no login.
      if (owner === GUEST && !cart.ownerId) guestCart.set(cart.id)
      return cart
    },
    staleTime: 10_000,
  })
}

/** Mutations do carrinho executam em série para que respostas não cheguem fora de ordem. */
const CART_SCOPE = { id: 'cart' }

/** Grava a resposta no cache; para visitantes, guarda o id do carrinho criado pelo servidor. */
function useStoreCart() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return (cart: Cart) => {
    if (owner === GUEST && !cart.ownerId) guestCart.set(cart.id)
    qc.setQueryData(queryKeys.cart(owner), cart)
  }
}

export function useAddToCart() {
  const storeCart = useStoreCart()
  return useMutation({
    scope: CART_SCOPE,
    mutationFn: (body: AddCartItemRequest) => api.cart.addItem(body),
    onSuccess: storeCart,
  })
}

export function useUpdateCartItem() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  const key = queryKeys.cart(owner)
  const storeCart = useStoreCart()
  return useMutation({
    scope: CART_SCOPE,
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => api.cart.updateItem(itemId, quantity),
    // Atualização otimista da quantidade, com rollback em caso de falha.
    onMutate: async ({ itemId, quantity }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Cart>(key)
      if (previous) {
        qc.setQueryData<Cart>(key, {
          ...previous,
          items: previous.items.map((i) => (i.id === itemId ? { ...i, quantity, lineTotal: mul(i.unitPrice, quantity) } : i)),
        })
      }
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous)
      toast.error(error.message || 'Não foi possível alterar a quantidade.')
    },
    onSuccess: storeCart,
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useRemoveCartItem() {
  const storeCart = useStoreCart()
  return useMutation({
    scope: CART_SCOPE,
    mutationFn: (itemId: string) => api.cart.removeItem(itemId),
    onSuccess: storeCart,
    onError: (error) => toast.error(error.message || 'Não foi possível remover o item.'),
  })
}

export function useCoupon() {
  const storeCart = useStoreCart()
  const apply = useMutation({
    scope: CART_SCOPE,
    mutationFn: (code: string) => api.cart.applyCoupon(code),
    onSuccess: storeCart,
  })
  const remove = useMutation({
    scope: CART_SCOPE,
    mutationFn: () => api.cart.removeCoupon(),
    onSuccess: storeCart,
  })
  return { apply, remove }
}

export function useAcknowledgeCart() {
  const storeCart = useStoreCart()
  return useMutation({
    scope: CART_SCOPE,
    mutationFn: () => api.cart.acknowledge(),
    onSuccess: storeCart,
  })
}
