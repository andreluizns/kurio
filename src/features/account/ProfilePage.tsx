import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { User } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { ImageIcon } from '@/components/icons'
import { ErrorState } from '@/components/feedback/ErrorState'
import { applyServerErrors, Field, PasswordInput } from '@/components/forms/Field'
import { NativeSelect } from '@/components/forms/NativeSelect'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAvatar, useChangePassword, useProfile, useUpdateProfile } from './queries'

const schema = z
  .object({
    displayName: z.string().trim().min(1, 'Informe o nome de exibição.').max(40, 'Use até 40 caracteres.'),
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9._]{3,24}$/, 'Use de 3 a 24 caracteres: letras minúsculas, números, ponto ou _.'),
    email: z.string().trim().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.'),
    ensSuffix: z.enum(['.eth', '.kurio.eth']),
    ensName: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,32}$/, 'Use de 3 a 32 letras minúsculas, números ou hífen.'),
    walletNickname: z.string().trim().min(1, 'Informe o apelido da carteira.').max(30, 'Use até 30 caracteres.'),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    const changing = v.currentPassword || v.newPassword || v.confirmPassword
    if (!changing) return
    if (!v.currentPassword) ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'Informe a senha atual.' })
    if (v.newPassword.length < 8) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'A nova senha deve ter pelo menos 8 caracteres.' })
    else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(v.newPassword)) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Use letras e números na nova senha.' })
    if (v.confirmPassword !== v.newPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'As senhas não coincidem.' })
  })

type Values = z.infer<typeof schema>

const toValues = (u: User): Values => ({
  displayName: u.displayName,
  username: u.username,
  email: u.email,
  ensSuffix: u.ensSuffix,
  ensName: u.ensName,
  walletNickname: u.walletNickname,
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const MAX_AVATAR = 2 * 1024 * 1024

function AvatarControl({ user }: { user: User }) {
  const { upload, remove } = useAvatar()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = upload.isPending || remove.isPending

  return (
    <div className="flex flex-col gap-2.5">
      <span id="avatar-label" className="text-[15px] leading-[15px] text-cream">
        Avatar
      </span>
      <div className="flex items-center gap-6" aria-labelledby="avatar-label" role="group">
        <span className="flex size-[50px] items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2 text-brand">
          {user.avatarUrl ? <img src={user.avatarUrl} alt={`Avatar de ${user.displayName}`} className="size-full object-cover" /> : <ImageIcon className="size-6" />}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Selecionar imagem de avatar"
          data-testid="avatar-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            if (file.size > MAX_AVATAR) {
              setError('A imagem deve ter até 2 MB.')
              return
            }
            setError(null)
            upload.mutate(file, {
              onSuccess: () => toast.success('Avatar atualizado.'),
              onError: (err) => setError(isApiError(err) ? err.fields.avatar ?? err.message : 'Não foi possível enviar a imagem.'),
            })
          }}
        />
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="h-10 w-[98px] rounded-[3px] bg-brand text-sm font-bold text-ink hover:bg-brand-light disabled:opacity-60"
          >
            {upload.isPending ? 'Enviando…' : 'Alterar'}
          </button>
          <button
            type="button"
            onClick={() => remove.mutate(undefined, { onSuccess: () => toast.success('Avatar removido.') })}
            disabled={busy || !user.avatarUrl}
            className="text-sm text-cream hover:text-brand-light disabled:opacity-40"
          >
            Remover
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-coral">
          {error}
        </p>
      )}
    </div>
  )
}

export function ProfilePage() {
  const { data: user, isPending, error, refetch, isFetching } = useProfile()
  const update = useUpdateProfile()
  const changePassword = useChangePassword()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' })
  const { errors, isDirty } = form.formState

  useEffect(() => {
    if (user) form.reset(toValues(user))
  }, [user, form])

  if (error && !user) return <ErrorState title="Não foi possível carregar o perfil" error={error} onRetry={() => void refetch()} retrying={isFetching} />

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    const { currentPassword, newPassword, ...profile } = values
    try {
      const saved = await update.mutateAsync(profile)
      if (newPassword) {
        try {
          await changePassword.mutateAsync({ currentPassword, newPassword })
        } catch (err) {
          setFormError(applyServerErrors(err, form.setError))
          form.reset({ ...toValues(saved), currentPassword, newPassword, confirmPassword: values.confirmPassword }, { keepErrors: true })
          return
        }
      }
      form.reset(toValues(saved))
      toast.success(newPassword ? 'Perfil e senha atualizados.' : 'Perfil atualizado.')
    } catch (err) {
      setFormError(applyServerErrors(err, form.setError))
    }
  })

  const saving = update.isPending || changePassword.isPending

  return (
    <section aria-labelledby="profile-title" className="flex flex-col gap-8">
      <h1 id="profile-title" className="text-base leading-4 font-bold text-cream">
        Perfil do colecionador
      </h1>
      {isPending || !user ? (
        <div className="grid gap-6 md:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[79px] w-full" />
          ))}
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-8">
          {formError && (
            <p role="alert" className="rounded-[3px] border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">
              {formError}
            </p>
          )}
          <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
            <Field label="Nome de exibição" required error={errors.displayName?.message}>
              {(p) => <Input {...p} {...form.register('displayName')} autoComplete="name" />}
            </Field>
            <Field label="Nome de usuário" required error={errors.username?.message}>
              {(p) => <Input {...p} {...form.register('username')} autoComplete="username" />}
            </Field>
            <Field label="E-mail" required error={errors.email?.message}>
              {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" />}
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
            <Field label="Apelido da carteira" required error={errors.walletNickname?.message}>
              {(p) => <Input {...p} {...form.register('walletNickname')} />}
            </Field>
            <AvatarControl user={user} />
          </div>

          <fieldset className="flex flex-col gap-6 md:max-w-[417px]">
            <legend className="mb-6 text-base leading-4 font-medium text-cream">Alterar senha</legend>
            <Field label="Senha atual" error={errors.currentPassword?.message}>
              {(p) => <PasswordInput {...p} {...form.register('currentPassword')} autoComplete="current-password" />}
            </Field>
            <Field label="Nova senha" error={errors.newPassword?.message}>
              {(p) => <PasswordInput {...p} {...form.register('newPassword')} autoComplete="new-password" />}
            </Field>
            <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
              {(p) => <PasswordInput {...p} {...form.register('confirmPassword')} autoComplete="new-password" />}
            </Field>
          </fieldset>
          <button
            type="submit"
            disabled={saving}
            className="h-10 w-[131px] rounded-[3px] bg-brand text-sm leading-4 font-bold text-ink hover:bg-brand-light disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          {!isDirty && <span className="sr-only">Nenhuma alteração pendente.</span>}
        </form>
      )}
    </section>
  )
}
