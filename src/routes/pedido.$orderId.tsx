import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/app/router'
import { OrderPage } from '@/features/orders/OrderPage'

export const Route = createFileRoute('/pedido/$orderId')({
  beforeLoad: requireAuth,
  component: function OrderRoute() {
    const { orderId } = Route.useParams()
    return <OrderPage orderId={orderId} />
  },
})
