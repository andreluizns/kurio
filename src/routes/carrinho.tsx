import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/features/cart/CartPage'
import { recommendationsOptions } from '@/features/catalog/queries'

export const Route = createFileRoute('/carrinho')({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(recommendationsOptions())
  },
  component: CartPage,
})
