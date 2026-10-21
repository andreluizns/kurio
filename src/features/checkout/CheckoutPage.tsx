import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch, type Control, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useRouter } from '@tanstack/react-router'
import type { Cart, Network, User, WalletProvider, WalletsResponse } from '@/api/contracts'
import { ArrowLeft2, Wallet as WalletIcon } from '@/components/icons'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Field } from '@/components/forms/Field'
import { NativeSelect } from '@/components/forms/NativeSelect'
import { PageShell } from '@/components/layout/PageShell'
import { WalletBrands } from '@/components/layout/Footer'
import { NftArtwork } from '@/components/nft/NftArtwork'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useProfile, useWallets } from '@/features/account/queries'
import { useSession } from '@/features/auth/session-store'
import { CartChanges } from '@/features/cart/CartPage'
import { checkoutBlockReason } from '@/features/cart/checkout-block'
import { CouponField, SummaryRows, SummarySkeleton } from '@/features/cart/CartSummary'
import { useCart } from '@/features/cart/use-cart'
import { NETWORK_LABELS } from '@/features/catalog/search-params'
import { formatEth } from '@/lib/money'
import { useIsDesktop } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { attemptStore, draftStore } from './attempt-store'
import { ReviewDialog } from './ReviewDialog'
import { checkoutSchema, PROVIDER_LABELS, type CheckoutValues } from './schema'

function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

function defaultsFrom(user: User | undefined, wallets: WalletsResponse | undefined): CheckoutValues {
  const wallet = wallets?.primary ?? null
  return {
    displayName: user?.displayName ?? '',
    username: user?.username ?? '',
    network: wallet?.network ?? 'ethereum',
    profileName: wallet?.profileName ?? '',
    walletSlot: wallet ? 'primary' : '',
    useOtherWallet: !wallet,
    address: wallet?.address ?? '',
    secondaryAddress: wallet?.secondaryAddress ?? '',
    referralCode: wallet?.referralCode ?? '',
    email: user?.email ?? '',
    ensName: user?.ensName ?? '',
    ensSuffix: user?.ensSuffix ?? '.eth',
    note: '',
    provider: wallet?.provider ?? 'metamask',
  }
}

/** Aplica uma carteira cadastrada aos campos do formulário. */
function applyWallet(form: UseFormReturn<CheckoutValues>, wallets: WalletsResponse | undefined, slot: 'primary' | 'secondary') {
  const wallet = wallets?.[slot]
  if (!wallet) return
  form.setValue('walletSlot', slot, { shouldValidate: true })
  form.setValue('useOtherWallet', false)
  form.setValue('address', wallet.address, { shouldValidate: true })
  form.setValue('network', wallet.network)
  form.setValue('provider', wallet.provider)
  if (wallet.secondaryAddress) form.setValue('secondaryAddress', wallet.secondaryAddress)
}

function useCheckoutForm() {
  const session = useSession()
  const userId = session?.user.id ?? ''
  const profile = useProfile()
  const wallets = useWallets()
  const ready = !profile.isPending && !wallets.isPending
  // Rascunho salvo (sessão expirada/refresh) ou dados do perfil e da carteira principal.
  const initial = useMemo(
    () => (ready ? (draftStore.get<CheckoutValues>(userId) ?? defaultsFrom(profile.data, wallets.data)) : undefined),
    [ready, userId, profile.data, wallets.data],
  )
  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: defaultsFrom(undefined, undefined),
    values: initial,
    resetOptions: { keepDirtyValues: true },
    mode: 'onTouched',
  })

  return { form, ready, wallets: wallets.data, error: profile.error ?? wallets.error, retry: () => void Promise.all([profile.refetch(), wallets.refetch()]) }
}

/** Persiste o rascunho do formulário (retomada após expiração de sessão ou refresh). */
function DraftPersistence({ control, userId }: { control: Control<CheckoutValues>; userId: string }) {
  const values = useWatch({ control })
  useEffect(() => draftStore.set(userId, values), [userId, values])
  return null
}

function ProviderOptions({ form, compact = false }: { form: UseFormReturn<CheckoutValues>; compact?: boolean }) {
  const provider = useWatch({ control: form.control, name: 'provider' })
  const error = form.formState.errors.provider?.message
  const options: { value: WalletProvider; content: React.ReactNode; mark?: string }[] = compact
    ? [
        { value: 'walletconnect', content: 'WalletConnect', mark: 'W' },
        { value: 'metamask', content: 'MetaMask', mark: 'M' },
        { value: 'coinbase', content: 'Coinbase Wallet' },
      ]
    : [
        { value: 'walletconnect', content: <WalletBrands className="h-[23px]" /> },
        { value: 'metamask', content: 'MetaMask' },
        { value: 'coinbase', content: 'Coinbase Wallet' },
      ]
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className={cn('mb-4 text-[17px] leading-4 font-bold text-cream', compact ? 'text-left' : 'w-full text-center')}>Carteira e rede</legend>
      {options.map((o) => {
        const checked = provider === o.value
        return (
          <label
            key={o.value}
            className={cn(
              'flex cursor-pointer items-center gap-3 border transition-colors',
              compact ? 'h-[65px] flex-row-reverse justify-between rounded-[14px] border-transparent bg-surface px-4' : 'h-[45px] rounded-[1px] border-line px-3',
              checked && !compact && 'border-cream',
              checked && compact && 'border-brand/50',
            )}
          >
            <input
              type="radio"
              name="provider"
              value={o.value}
              checked={checked}
              onChange={() => form.setValue('provider', o.value, { shouldValidate: true })}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-light',
                compact && !checked && 'border-line-2',
              )}
            >
              {checked && <span className="size-2 rounded-full bg-brand" />}
            </span>
            <span className={cn('flex items-center gap-3 text-[15px] leading-5 text-cream', compact && 'flex-1')}>
              {compact &&
                (o.mark ? (
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-sm font-bold text-brand-light">
                    {o.mark}
                  </span>
                ) : (
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-full border border-line bg-surface-2 text-brand-light">
                    <WalletIcon className="size-6" />
                  </span>
                ))}
              {o.content}
              {o.value === 'walletconnect' && !compact && <span className="sr-only">WalletConnect</span>}
            </span>
          </label>
        )
      })}
      {error && (
        <p role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}
    </fieldset>
  )
}

function BuyerFields({ form, wallets }: { form: UseFormReturn<CheckoutValues>; wallets?: WalletsResponse }) {
  const { register, formState } = form
  const e = formState.errors
  const useOther = useWatch({ control: form.control, name: 'useOtherWallet' })
  const hasWallets = !!(wallets?.primary || wallets?.secondary)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
        <Field label="Nome de exibição" required error={e.displayName?.message}>
          {(p) => <Input {...p} {...register('displayName')} autoComplete="name" />}
        </Field>
        <Field label="Nome de usuário" required error={e.username?.message}>
          {(p) => <Input {...p} {...register('username')} autoComplete="username" />}
        </Field>
        <Field label="Rede" required error={e.network?.message}>
          {(p) => (
            <NativeSelect {...p} {...register('network')}>
              {(['ethereum', 'polygon', 'solana'] as Network[]).map((n) => (
                <option key={n} value={n}>
                  {NETWORK_LABELS[n]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Nome do perfil" required error={e.profileName?.message}>
          {(p) => <Input {...p} {...register('profileName')} />}
        </Field>
        <Field label="Endereço da carteira" required error={e.address?.message} hint={!useOther ? 'Preenchido pela carteira selecionada.' : undefined}>
          {(p) => <Input {...p} {...register('address')} readOnly={!useOther} placeholder="Endereço 0x da carteira" className={cn(!useOther && 'text-sand')} spellCheck={false} />}
        </Field>
        <Field label="ENS ou carteira secundária (opcional)" hideLabel error={e.secondaryAddress?.message} className="md:pt-[25px]">
          {(p) => <Input {...p} {...register('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} />}
        </Field>
        <Field label="Tipo de carteira" required error={e.walletSlot?.message}>
          {(p) => (
            <NativeSelect
              {...p}
              value={form.watch('walletSlot')}
              disabled={useOther || !hasWallets}
              onChange={(ev) => applyWallet(form, wallets, ev.target.value as 'primary' | 'secondary')}
            >
              <option value="">Selecione uma carteira</option>
              {wallets?.primary && (
                <option value="primary">
                  Carteira principal · {shortAddress(wallets.primary.address)}
                </option>
              )}
              {wallets?.secondary && (
                <option value="secondary">
                  Carteira secundária · {shortAddress(wallets.secondary.address)}
                </option>
              )}
            </NativeSelect>
          )}
        </Field>
        <Field label="Código de indicação" required error={e.referralCode?.message}>
          {(p) => <Input {...p} {...register('referralCode')} autoCapitalize="characters" />}
        </Field>
        <Field label="E-mail" required error={e.email?.message}>
          {(p) => <Input {...p} {...register('email')} type="email" autoComplete="email" />}
        </Field>
        <Field label="Nome ENS" required error={e.ensName?.message}>
          {(p) => (
            <div className="flex gap-2.5">
              <NativeSelect {...register('ensSuffix')} aria-label="Sufixo ENS" wrapperClassName="shrink-0" className="w-auto min-w-[78px] pr-8 pl-2.5">
                <option value=".eth">.eth</option>
                <option value=".kurio.eth">.kurio.eth</option>
              </NativeSelect>
              <Input {...p} {...register('ensName')} placeholder="seu-nome" />
            </div>
          )}
        </Field>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-[15px] leading-5 text-cream">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={useOther}
          onChange={(ev) => {
            form.setValue('useOtherWallet', ev.target.checked)
            if (ev.target.checked) {
              form.setValue('walletSlot', '')
              form.setValue('address', '')
            } else if (wallets?.primary) {
              applyWallet(form, wallets, 'primary')
            }
          }}
          disabled={!hasWallets}
        />
        <span aria-hidden className="flex size-4 items-center justify-center rounded-full border-[1.5px] border-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-light">
          {useOther && <span className="size-2 rounded-full bg-brand" />}
        </span>
        Usar outra carteira?
      </label>
      {!hasWallets && (
        <p className="text-xs text-khaki">
          Você ainda não tem carteiras cadastradas.{' '}
          <Link to="/conta/carteiras" className="text-brand-light underline">
            Cadastrar carteira
          </Link>
        </p>
      )}
      <Field label="Observação do colecionador (opcional)" error={e.note?.message} className="max-w-[350px]">
        {(p) => <Textarea {...p} {...register('note')} rows={6} className="h-[151px] resize-none" />}
      </Field>
    </div>
  )
}

function OrderLines({ cart }: { cart: Cart }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between border-b border-brand/30 pb-3 text-base leading-4 text-cream" aria-hidden>
        <span className="font-bold">NFTs</span>
        <span className="font-medium">Subtotal</span>
      </div>
      <ul className="flex flex-col gap-3">
        {cart.items.map((item) => (
          <li key={item.id} className="flex h-[70px] items-center gap-2 bg-surface pr-3">
            <NftArtwork artwork={item.artwork} alt="" sizes="64px" className="ml-1 size-16 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="truncate text-base leading-4 font-bold tracking-[-0.02em] text-cream">{item.name}</span>
              <span className="text-sm leading-4 text-khaki">ID do token: {item.tokenId}</span>
            </div>
            <span className="text-sm text-sand">
              (x {item.quantity})<span className="sr-only"> unidades</span>
            </span>
            <span className="text-right text-lg leading-4 font-bold whitespace-nowrap text-brand-light">{formatEth(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PendingAttemptBanner({ onResume }: { onResume: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-brand bg-brand/10 p-4 text-sm text-cream sm:flex-row sm:items-center sm:justify-between">
      <span>Há um pedido seu em verificação desta sessão. Retome para confirmar o status — nenhuma compra duplicada será criada.</span>
      <button type="button" onClick={onResume} className="shrink-0 rounded-md bg-brand px-4 py-2 font-bold text-ink">
        Retomar pedido
      </button>
    </div>
  )
}

export function CheckoutPage() {
  const isDesktop = useIsDesktop()
  const session = useSession()
  const userId = session?.user.id ?? ''
  const { data: cart, isPending: cartPending, error: cartError, refetch } = useCart()
  const { form, ready, wallets, error, retry } = useCheckoutForm()
  // O diálogo é desmontado ao fechar: cada abertura começa uma revisão nova.
  const [review, setReview] = useState<{ values: CheckoutValues; resume: boolean } | null>(null)
  const [showCoupon, setShowCoupon] = useState(false)
  const hasAttempt = !!attemptStore.get(userId)
  const router = useRouter()

  const submit = form.handleSubmit(
    (values) => setReview({ values, resume: false }),
    () => {
      // Foca o primeiro campo com erro (feito pelo react-hook-form) e anuncia.
    },
  )
  const resume = () => {
    const attempt = attemptStore.get(userId)
    if (attempt) setReview({ values: form.getValues(), resume: true })
  }

  const blockReason = checkoutBlockReason(cart)
  const blocked = !cart || !cart.items.length || !!blockReason

  if (cart && !cart.items.length && !hasAttempt) {
    return (
      <PageShell>
        <div className="mt-16 flex flex-col items-center gap-3 text-center" role="status">
          <h1 className="text-xl font-bold text-cream">Seu carrinho está vazio</h1>
          <p className="text-sm text-sand">Adicione NFTs ao carrinho para finalizar uma compra.</p>
          <Link to="/" hash="catalogo" className="rounded-md bg-brand px-5 py-2 text-sm font-bold text-ink">
            Explorar NFTs
          </Link>
        </div>
      </PageShell>
    )
  }

  const reviewDialog = (
    <>
      {ready && <DraftPersistence control={form.control} userId={userId} />}
      {review && <ReviewDialog onOpenChange={(open) => !open && setReview(null)} values={review.values} resume={review.resume} />}
    </>
  )

  if (!isDesktop) {
    return (
      <div className="flex min-h-dvh flex-col px-7 pt-8 pb-[140px]">
        <main id="conteudo" tabIndex={-1} className="flex flex-col gap-5 focus:outline-none">
          <div className="relative flex h-11 items-center justify-center">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: '/carrinho' }))}
              aria-label="Voltar"
              className="absolute left-0 flex size-[35px] items-center justify-center rounded-full border border-line bg-surface-2 text-khaki"
            >
              <ArrowLeft2 className="size-5" />
            </button>
            <h1 className="text-xl leading-4 font-bold text-cream">Pagamento com carteira</h1>
          </div>
          {hasAttempt && <PendingAttemptBanner onResume={resume} />}
          {cart && <CartChanges cart={cart} />}
          {!ready ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <Skeleton className="h-[92px] w-full rounded-[14px]" />
              <Skeleton className="h-[92px] w-full rounded-[14px]" />
              <Skeleton className="h-[65px] w-full rounded-[14px]" />
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="flex flex-col gap-5">
              <fieldset className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <legend className="text-[17px] leading-4 font-bold text-cream">Carteira conectada</legend>
                  <Link to="/conta/carteiras" className="text-sm font-bold text-brand-light">
                    Trocar carteira
                  </Link>
                </div>
                {(['secondary', 'primary'] as const).map((slot) => {
                  const wallet = wallets?.[slot]
                  if (!wallet) return null
                  const checked = form.watch('walletSlot') === slot && !form.watch('useOtherWallet')
                  return (
                    <label key={slot} className={cn('flex cursor-pointer items-start gap-4 rounded-[14px] border bg-surface p-4', checked ? 'border-brand/50' : 'border-transparent')}>
                      <input type="radio" name="wallet" className="peer sr-only" checked={checked} onChange={() => applyWallet(form, wallets, slot)} />
                      <span aria-hidden className="mt-1 flex size-4 items-center justify-center rounded-full border-[1.5px] border-brand peer-focus-visible:outline-2 peer-focus-visible:outline-brand-light">
                        {checked && <span className="size-2 rounded-full bg-brand" />}
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="text-base font-bold text-cream">{wallet.nickname}</span>
                        <span className="text-sm text-sand">{wallet.secondaryAddress || shortAddress(wallet.address)}</span>
                        <span className="text-sm text-sand">Rede {NETWORK_LABELS[wallet.network]}</span>
                      </span>
                    </label>
                  )
                })}
                {form.formState.errors.walletSlot && <p className="text-xs text-coral">{form.formState.errors.walletSlot.message}</p>}
              </fieldset>
              <ProviderOptions form={form} compact />
              <details className="rounded-[14px] bg-surface p-4">
                <summary className="cursor-pointer text-[15px] font-bold text-cream">Dados do colecionador</summary>
                <div className="mt-4">
                  <BuyerFields form={form} wallets={wallets} />
                </div>
              </details>
              <div className="flex items-center justify-end gap-6 text-lg font-bold">
                <span className="text-cream">Total:</span>
                <span className="text-xl text-brand-light">{cart ? formatEth(cart.summary.total) : '—'}</span>
              </div>
              <div className="fixed inset-x-0 bottom-0 z-40 bg-ink/95 px-7 pt-3 pb-9">
                {blockReason && (
                  <p id="checkout-block-reason-mobile" className="mb-2 text-center text-xs text-coral">
                    {blockReason}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={blocked}
                  aria-describedby={blockReason ? 'checkout-block-reason-mobile' : undefined}
                  className="h-[60px] w-full rounded-[40px] bg-[linear-gradient(90deg,#d28a4c,#b8763f)] text-base font-bold text-ink disabled:opacity-50"
                >
                  Confirmar compra
                </button>
              </div>
            </form>
          )}
          {error && <ErrorState title="Não foi possível carregar seus dados" error={error} onRetry={retry} />}
        </main>
        {reviewDialog}
      </div>
    )
  }

  return (
    <PageShell className="flex flex-col gap-6 pt-8">
      <nav aria-label="Trilha de navegação">
        <ol className="flex gap-1 text-[15px] leading-4 font-bold text-cream">
          <li>
            <Link to="/">Início</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/" hash="catalogo">
              Mercado
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">Pagamento</li>
        </ol>
      </nav>
      <h1 className="sr-only">Pagamento</h1>
      {hasAttempt && <PendingAttemptBanner onResume={resume} />}
      {cart && <CartChanges cart={cart} />}
      <form noValidate onSubmit={submit} className="flex flex-col gap-10 lg:flex-row lg:justify-between">
        <section aria-labelledby="buyer-title" className="flex min-w-0 flex-1 flex-col gap-4 lg:max-w-[763px]">
          <h2 id="buyer-title" className="text-[17px] leading-4 font-bold text-cream">
            Perfil do colecionador
          </h2>
          {error ? (
            <ErrorState title="Não foi possível carregar seus dados" error={error} onRetry={retry} />
          ) : !ready ? (
            <div className="grid gap-6 md:grid-cols-2" aria-busy="true" aria-label="Carregando dados">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className="h-[65px] w-full" />
              ))}
            </div>
          ) : (
            <BuyerFields form={form} wallets={wallets} />
          )}
        </section>
        <aside aria-labelledby="order-title" className="flex w-full flex-col gap-3 lg:w-[405px]">
          <h2 id="order-title" className="text-[17px] leading-4 font-bold text-cream">
            Seus NFTs
          </h2>
          {cartError && !cart ? (
            <ErrorState title="Não foi possível carregar o carrinho" error={cartError} onRetry={() => void refetch()} />
          ) : cartPending || !cart ? (
            <SummarySkeleton />
          ) : (
            <>
              <OrderLines cart={cart} />
              {showCoupon || cart.coupon ? (
                <CouponField cart={cart} />
              ) : (
                <button type="button" onClick={() => setShowCoupon(true)} className="text-center text-sm leading-4 text-cream hover:text-brand-light">
                  Tem um código promocional? <span className="underline-offset-4 hover:underline">Aplique aqui</span>
                </button>
              )}
              <div aria-live="polite">
                <SummaryRows summary={cart.summary} />
              </div>
              <ProviderOptions form={form} />
              <button
                type="submit"
                disabled={blocked || !ready}
                aria-describedby={blockReason ? 'checkout-block-reason' : undefined}
                className="mt-3 h-[45px] rounded-[5px] bg-brand text-[15px] leading-4 font-bold text-ink hover:bg-brand-light disabled:opacity-50"
              >
                Confirmar compra
              </button>
              {blockReason && (
                <p id="checkout-block-reason" className="text-center text-xs text-coral">
                  {blockReason}
                </p>
              )}
              <p className="text-center text-xs text-khaki">
                Você revisará itens, cotação e carteira antes do envio. Pagamento: {PROVIDER_LABELS[form.watch('provider')]}.
              </p>
            </>
          )}
        </aside>
      </form>
      {reviewDialog}
    </PageShell>
  )
}
