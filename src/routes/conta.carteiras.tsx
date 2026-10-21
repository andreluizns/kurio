import { createFileRoute } from '@tanstack/react-router'
import { WalletsPage } from '@/features/account/WalletsPage'

export const Route = createFileRoute('/conta/carteiras')({
  component: WalletsPage,
})
