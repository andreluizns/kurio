import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/app/router'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'

export const Route = createFileRoute('/pagamento')({
  beforeLoad: requireAuth,
  component: CheckoutPage,
})
