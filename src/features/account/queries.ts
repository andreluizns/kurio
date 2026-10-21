import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PasswordChange, ProfileUpdate, User, WalletInput, WalletSlot, WalletsResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { sessionStore, useSession } from '@/features/auth/session-store'

function useUserId() {
  return useSession()?.user.id ?? 'anonymous'
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: ({ signal }) => api.profile.get({ signal }),
    enabled: userId !== 'anonymous',
  })
}

export function useWallets() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.wallets(userId),
    queryFn: ({ signal }) => api.wallets.list({ signal }),
    enabled: userId !== 'anonymous',
  })
}

function useProfileCache() {
  const qc = useQueryClient()
  const userId = useUserId()
  return (user: User) => {
    qc.setQueryData(queryKeys.profile(userId), user)
    // O cabeçalho exibe nome e avatar da sessão.
    sessionStore.updateUser(user)
  }
}

export function useUpdateProfile() {
  const setProfile = useProfileCache()
  return useMutation({ mutationFn: (body: ProfileUpdate) => api.profile.update(body), onSuccess: setProfile })
}

export function useAvatar() {
  const setProfile = useProfileCache()
  const upload = useMutation({ mutationFn: (file: File) => api.profile.uploadAvatar(file), onSuccess: setProfile })
  const remove = useMutation({ mutationFn: () => api.profile.removeAvatar(), onSuccess: setProfile })
  return { upload, remove }
}

export function useChangePassword() {
  return useMutation({ mutationFn: (body: PasswordChange) => api.profile.changePassword(body) })
}

export function useSaveWallet() {
  const qc = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: ({ slot, body }: { slot: WalletSlot; body: WalletInput }) => api.wallets.save(slot, body),
    onSuccess: (wallet) => {
      qc.setQueryData<WalletsResponse>(queryKeys.wallets(userId), (current) => ({
        primary: current?.primary ?? null,
        secondary: current?.secondary ?? null,
        [wallet.slot]: wallet,
      }))
    },
  })
}

export function useRemoveSecondaryWallet() {
  const qc = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: () => api.wallets.removeSecondary(),
    onSuccess: () =>
      qc.setQueryData<WalletsResponse>(queryKeys.wallets(userId), (current) => ({ primary: current?.primary ?? null, secondary: null })),
  })
}
