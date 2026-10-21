import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { Network, Wallet, WalletInput, WalletProvider, WalletSlot } from '@/api/contracts'
import { ErrorState } from '@/components/feedback/ErrorState'
import { applyServerErrors, Field } from '@/components/forms/Field'
import { NativeSelect } from '@/components/forms/NativeSelect'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { NETWORK_LABELS } from '@/features/catalog/search-params'
import { PROVIDER_LABELS } from '@/features/checkout/schema'
import { useProfile, useRemoveSecondaryWallet, useSaveWallet, useWallets } from './queries'

const schema = z.object({
  displayName: z.string().trim().min(1, 'Informe o nome de exibição.'),
  nickname: z.string().trim().min(1, 'Informe o apelido da carteira.'),
  network: z.enum(['ethereum', 'polygon', 'solana'], { message: 'Selecione uma rede.' }),
  profileName: z.string().trim().min(1, 'Informe o nome do perfil.'),
  address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, 'Informe um endereço 0x com 40 caracteres hexadecimais.'),
  secondaryAddress: z
    .string()
    .trim()
    .refine((v) => !v || /^0x[a-fA-F0-9]{40}$/.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(v), 'Informe um endereço 0x ou um nome ENS (ex.: nome.eth).'),
  provider: z.enum(['metamask', 'walletconnect', 'coinbase'], { message: 'Selecione uma carteira.' }),
  referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,20}$/, 'Use de 4 a 20 letras, números ou hífen.'),
  email: z.string().trim().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.'),
  ensSuffix: z.enum(['.eth', '.kurio.eth']),
  ensName: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,32}$/, 'Use de 3 a 32 letras minúsculas, números ou hífen.'),
})

// Os selects começam vazios ("Selecione…"); o schema exige um valor válido.
type FormValues = Omit<WalletInput, 'network' | 'provider'> & { network: Network | ''; provider: WalletProvider | '' }

const EMPTY: FormValues = {
  displayName: '',
  nickname: '',
  network: '',
  profileName: '',
  address: '',
  secondaryAddress: '',
  provider: '',
  referralCode: '',
  email: '',
  ensSuffix: '.eth',
  ensName: '',
}

function toForm(wallet: Wallet | null | undefined, fallback: Partial<FormValues> = {}): FormValues {
  if (!wallet) return { ...EMPTY, ...fallback }
  const { slot: _s, updatedAt: _u, ...rest } = wallet
  return rest
}

function WalletForm({ slot, wallet, initial, onSaved }: { slot: WalletSlot; wallet: Wallet | null; initial: FormValues; onSaved?: () => void }) {
  const save = useSaveWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) as never, defaultValues: initial, mode: 'onTouched' })
  const { errors } = form.formState
  const prefix = `${slot}-`

  useEffect(() => form.reset(initial), [initial, form])

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null)
    save.mutate(
      { slot, body: values as WalletInput },
      {
        onSuccess: (saved) => {
          form.reset(toForm(saved))
          toast.success(slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
          onSaved?.()
        },
        onError: (err) => setFormError(applyServerErrors(err, form.setError)),
      },
    )
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-8" aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'} data-testid={`${prefix}form`}>
      {formError && (
        <p role="alert" className="rounded-[3px] border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">
          {formError}
        </p>
      )}
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          {(p) => <Input {...p} {...form.register('displayName')} />}
        </Field>
        <Field label="Apelido da carteira" required error={errors.nickname?.message}>
          {(p) => <Input {...p} {...form.register('nickname')} />}
        </Field>
        <Field label="Rede" required error={errors.network?.message}>
          {(p) => (
            <NativeSelect {...p} {...form.register('network')}>
              <option value="">Selecione uma rede</option>
              {(['ethereum', 'polygon', 'solana'] as Network[]).map((n) => (
                <option key={n} value={n}>
                  {NETWORK_LABELS[n]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Nome do perfil" required error={errors.profileName?.message}>
          {(p) => <Input {...p} {...form.register('profileName')} />}
        </Field>
        <Field label="Endereço da carteira" required error={errors.address?.message}>
          {(p) => <Input {...p} {...form.register('address')} placeholder="Endereço 0x da carteira" spellCheck={false} />}
        </Field>
        <Field label="ENS ou carteira secundária (opcional)" hideLabel error={errors.secondaryAddress?.message} className="md:pt-[25px]">
          {(p) => <Input {...p} {...form.register('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} />}
        </Field>
        <Field label="Tipo de carteira" required error={errors.provider?.message}>
          {(p) => (
            <NativeSelect {...p} {...form.register('provider')}>
              <option value="">Selecione uma carteira</option>
              {(Object.keys(PROVIDER_LABELS) as WalletProvider[]).map((v) => (
                <option key={v} value={v}>
                  {PROVIDER_LABELS[v]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Código de indicação" required error={errors.referralCode?.message}>
          {(p) => <Input {...p} {...form.register('referralCode')} autoCapitalize="characters" />}
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          {(p) => <Input {...p} {...form.register('email')} type="email" />}
        </Field>
        <Field label="Nome ENS" required error={errors.ensName?.message}>
          {(p) => (
            <div className="flex gap-2.5">
              <NativeSelect {...form.register('ensSuffix')} aria-label="Sufixo ENS" wrapperClassName="shrink-0" className="w-auto min-w-[78px] pr-8 pl-2.5">
                <option value=".eth">.eth</option>
                <option value=".kurio.eth">.kurio.eth</option>
              </NativeSelect>
              <Input {...p} {...form.register('ensName')} />
            </div>
          )}
        </Field>
      </div>
      <button
        type="submit"
        disabled={save.isPending}
        className="h-10 w-fit rounded-[3px] bg-brand px-1 text-sm leading-4 font-bold text-ink hover:bg-brand-light disabled:opacity-60"
      >
        {save.isPending ? 'Salvando…' : wallet ? 'Salvar carteira' : 'Salvar carteira'}
      </button>
    </form>
  )
}

export function WalletsPage() {
  const { data, isPending, error, refetch, isFetching } = useWallets()
  const { data: user } = useProfile()
  const removeSecondary = useRemoveSecondaryWallet()
  const [addingPrimary, setAddingPrimary] = useState(false)
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  if (error && !data) return <ErrorState title="Não foi possível carregar suas carteiras" error={error} onRetry={() => void refetch()} retrying={isFetching} />
  if (isPending || !data) {
    return (
      <div className="grid gap-6 md:grid-cols-2" aria-busy="true" aria-label="Carregando carteiras">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[65px] w-full" />
        ))}
      </div>
    )
  }

  const fallback: Partial<FormValues> = user ? { displayName: user.displayName, email: user.email, ensName: user.ensName, ensSuffix: user.ensSuffix } : {}
  const primaryInitial = toForm(data.primary, fallback)
  const secondaryInitial =
    sameAsPrimary && data.primary ? { ...toForm(data.primary), nickname: `${data.primary.nickname} (cópia)` } : toForm(data.secondary, fallback)
  const showPrimaryForm = !!data.primary || addingPrimary
  const showSecondaryForm = !!data.secondary || addingSecondary

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="primary-title" className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 id="primary-title" className="text-base leading-4 font-bold text-cream">
              Carteira principal
            </h1>
            <p className="text-sm text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!showPrimaryForm && (
            <button type="button" onClick={() => setAddingPrimary(true)} className="text-base font-bold text-brand-light hover:underline">
              Adicionar
            </button>
          )}
        </div>
        {showPrimaryForm ? (
          <WalletForm slot="primary" wallet={data.primary} initial={primaryInitial} />
        ) : (
          <p className="text-sm text-sand">Você ainda não adicionou uma carteira principal.</p>
        )}
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="secondary-title" className="text-base leading-4 font-bold text-cream">
            Carteira secundária
          </h2>
          <div className="flex items-center gap-2">
            {data.primary && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-cream">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={sameAsPrimary}
                  onChange={(e) => {
                    setSameAsPrimary(e.target.checked)
                    if (e.target.checked) setAddingSecondary(true)
                  }}
                />
                <span aria-hidden className="flex size-4 items-center justify-center rounded-full border-[1.5px] border-brand peer-focus-visible:outline-2 peer-focus-visible:outline-brand-light">
                  {sameAsPrimary && <span className="size-2 rounded-full bg-brand" />}
                </span>
                Igual à carteira principal
              </label>
            )}
            {!showSecondaryForm ? (
              <button
                type="button"
                onClick={() => setAddingSecondary(true)}
                disabled={!data.primary}
                title={!data.primary ? 'Cadastre a carteira principal primeiro' : undefined}
                className="text-base font-bold text-brand-light hover:underline disabled:opacity-40"
              >
                Adicionar
              </button>
            ) : (
              data.secondary && (
                <button
                  type="button"
                  onClick={() => removeSecondary.mutate(undefined, { onSuccess: () => toast.success('Carteira secundária removida.') })}
                  className="text-sm text-coral hover:underline"
                >
                  Remover
                </button>
              )
            )}
          </div>
        </div>
        {showSecondaryForm ? (
          <WalletForm slot="secondary" wallet={data.secondary} initial={secondaryInitial} onSaved={() => setSameAsPrimary(false)} />
        ) : (
          <p className="text-sm text-sand">Você ainda não adicionou uma carteira secundária.</p>
        )}
      </section>
    </div>
  )
}
