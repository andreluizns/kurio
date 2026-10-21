import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/app/router'
import { AccountLayout } from '@/features/account/AccountLayout'

export const Route = createFileRoute('/conta')({
  beforeLoad: requireAuth,
  component: () => (
    <AccountLayout>
      <Outlet />
    </AccountLayout>
  ),
})
