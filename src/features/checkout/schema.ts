import { z } from 'zod'
import type { WalletProvider } from '@/api/contracts'

export const PROVIDER_LABELS: Record<WalletProvider, string> = {
  walletconnect: 'WalletConnect',
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
}

const required = (label: string) => z.string().trim().min(1, `Informe ${label}.`)

export const checkoutSchema = z
  .object({
    displayName: required('o nome de exibição'),
    username: z
      .string()
      .trim()
      .regex(/^[a-z0-9._]{3,24}$/, 'Use de 3 a 24 caracteres: letras minúsculas, números, ponto ou _.'),
    network: z.enum(['ethereum', 'polygon', 'solana'], { message: 'Selecione uma rede.' }),
    profileName: required('o nome do perfil'),
    walletSlot: z.enum(['primary', 'secondary', '']),
    useOtherWallet: z.boolean(),
    address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, 'Informe um endereço 0x com 40 caracteres hexadecimais.'),
    secondaryAddress: z
      .string()
      .trim()
      .refine((v) => !v || /^0x[a-fA-F0-9]{40}$/.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(v), 'Informe um endereço 0x ou um nome ENS (ex.: nome.eth).'),
    referralCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{4,20}$/, 'Use de 4 a 20 letras, números ou hífen.'),
    email: z.string().trim().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.'),
    ensName: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]{3,32}$/, 'Use de 3 a 32 letras minúsculas, números ou hífen.'),
    ensSuffix: z.enum(['.eth', '.kurio.eth']),
    note: z.string().max(280, 'Use até 280 caracteres.'),
    provider: z.enum(['metamask', 'walletconnect', 'coinbase'], { message: 'Selecione a carteira para conectar.' }),
  })
  .refine((v) => v.useOtherWallet || v.walletSlot !== '', { path: ['walletSlot'], message: 'Selecione uma carteira cadastrada ou use outra carteira.' })

export type CheckoutValues = z.infer<typeof checkoutSchema>
