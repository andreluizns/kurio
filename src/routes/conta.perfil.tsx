import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/account/ProfilePage'

export const Route = createFileRoute('/conta/perfil')({
  component: ProfilePage,
})
