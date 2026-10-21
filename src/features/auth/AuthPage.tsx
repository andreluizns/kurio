import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { safeRedirect } from '@/app/router'
import { applyServerErrors, Field, PasswordInput } from '@/components/forms/Field'
import { FacebookLogo, GoogleLogo } from '@/components/icons'
import { Wordmark } from '@/components/layout/Header'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { HomePage } from '@/features/catalog/HomePage'
import { comingSoon } from '@/lib/coming-soon'
import { useIsDesktop } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { useLogin, useRegister } from './use-auth'

type Mode = 'login' | 'register'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._]{3,24}$/, 'Use de 3 a 24 caracteres: letras minúsculas, números, ponto ou _.'),
    email: z.string().trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.').regex(/(?=.*[A-Za-z])(?=.*\d)/, 'Use letras e números na senha.'),
    confirm: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não coincidem.' })

type LoginValues = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>

interface AuthProps {
  redirect?: string
  reason?: string
  mobile: boolean
}

const inputClass = (mobile: boolean) =>
  cn('text-sm', mobile ? 'h-[50px] rounded-xl border-line bg-ink px-4 text-[15px]' : 'h-10 rounded-[5px]')

function useFinish(redirect?: string) {
  const navigate = useNavigate()
  return () => void navigate({ href: safeRedirect(redirect), replace: true })
}

function SocialButtons({ mobile }: { mobile: boolean }) {
  const cls = 'flex h-10 w-full items-center justify-center gap-3 rounded-[5px] border border-line text-[13px] leading-4 font-medium text-sand hover:border-brand'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[13px] leading-4 text-cream">Ou continue com</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className={cn('flex flex-col gap-3', !mobile && 'px-20')}>
        <button type="button" className={cls} onClick={() => comingSoon('O login com Google')}>
          <GoogleLogo className="size-5" /> Continuar com Google
        </button>
        <button type="button" className={cls} onClick={() => comingSoon('O login com Facebook')}>
          <FacebookLogo className="size-5" /> Continuar com Facebook
        </button>
      </div>
    </div>
  )
}

function FormAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-[5px] border border-coral/50 bg-coral/10 px-3 py-2 text-[13px] leading-5 text-coral">
      {message}
    </p>
  )
}

function LoginForm({ redirect, reason, mobile }: AuthProps) {
  const login = useLogin()
  const finish = useFinish(redirect)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null)
    login.mutate(values, {
      onSuccess: (session) => {
        toast.success(`Bem-vindo de volta, ${session.user.displayName.split(' ')[0]}!`)
        finish()
      },
      onError: (error) => setFormError(applyServerErrors(error, form.setError)),
    })
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Entrar na Kurio">
      {reason === 'expirada' && (
        <p role="status" className="rounded-[5px] border border-brand/50 bg-brand/10 px-3 py-2 text-[13px] leading-5 text-cream">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}
      <FormAlert message={formError} />
      <Field label="E-mail" hideLabel error={errors.email?.message}>
        {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" placeholder="contato@email.com" className={inputClass(mobile)} />}
      </Field>
      <Field label="Senha" hideLabel error={errors.password?.message}>
        {(p) => <PasswordInput {...p} {...form.register('password')} autoComplete="current-password" placeholder="Senha" className={inputClass(mobile)} />}
      </Field>
      <div className="flex justify-end">
        <button type="button" onClick={() => comingSoon('A recuperação de senha')} className="text-sm leading-4 text-brand-light hover:underline">
          Esqueceu a senha?
        </button>
      </div>
      <button
        type="submit"
        disabled={login.isPending}
        className={cn('mt-6 font-bold text-ink hover:bg-brand-light disabled:opacity-60', mobile ? 'h-[60px] rounded-xl bg-brand text-lg' : 'h-[45px] rounded-[5px] bg-brand text-base')}
      >
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function RegisterForm({ redirect, mobile }: AuthProps) {
  const register = useRegister()
  const finish = useFinish(redirect)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', confirm: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(({ username, email, password }) => {
    setFormError(null)
    register.mutate(
      { username, email, password },
      {
        onSuccess: () => {
          toast.success('Conta criada! Complete seu perfil quando quiser.')
          finish()
        },
        onError: (error) => setFormError(applyServerErrors(error, form.setError)),
      },
    )
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Criar conta na Kurio">
      <FormAlert message={formError} />
      <Field label="Nome de usuário" hideLabel error={errors.username?.message}>
        {(p) => <Input {...p} {...form.register('username')} autoComplete="username" placeholder="Nome de usuário" className={cn(inputClass(mobile), mobile && 'text-center')} />}
      </Field>
      <Field label="E-mail" hideLabel error={errors.email?.message}>
        {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" placeholder="Digite seu e-mail" className={inputClass(mobile)} />}
      </Field>
      <Field label="Senha" hideLabel error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números.">
        {(p) => <PasswordInput {...p} {...form.register('password')} autoComplete="new-password" placeholder="Senha" className={inputClass(mobile)} />}
      </Field>
      <Field label="Confirmar senha" hideLabel error={errors.confirm?.message}>
        {(p) => <PasswordInput {...p} {...form.register('confirm')} autoComplete="new-password" placeholder="Confirmar senha" className={inputClass(mobile)} />}
      </Field>
      <button
        type="submit"
        disabled={register.isPending}
        className={cn('mt-4 font-bold text-ink hover:bg-brand-light disabled:opacity-60', mobile ? 'h-[60px] rounded-xl bg-brand text-lg' : 'h-[45px] rounded-[5px] bg-brand text-base')}
      >
        {register.isPending ? 'Criando…' : mobile ? 'Criar perfil' : 'Criar conta'}
      </button>
    </form>
  )
}

function ModeSwitch({ mode, redirect }: { mode: Mode; redirect?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xl leading-4 font-medium">
      <Link to="/entrar" search={{ redirect }} replace aria-current={mode === 'login' ? 'page' : undefined} className={mode === 'login' ? 'text-brand-light' : 'text-cream hover:text-brand-light'}>
        Entrar
      </Link>
      <span aria-hidden className="h-5 w-px bg-coral" />
      <Link to="/cadastro" search={{ redirect }} replace aria-current={mode === 'register' ? 'page' : undefined} className={mode === 'register' ? 'text-brand-light' : 'text-cream hover:text-brand-light'}>
        Criar conta
      </Link>
    </div>
  )
}

/** Desktop: modal sobre a página inicial (como no layout). Mobile: tela cheia. */
export function AuthPage({ mode, redirect, reason }: { mode: Mode; redirect?: string; reason?: string }) {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const subtitle =
    mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'

  if (!isDesktop) {
    return (
      <main id="conteudo" className="flex min-h-dvh flex-col px-7 pt-[130px] pb-10">
        <Link to="/" aria-label="Kurio — página inicial" className="mx-auto">
          <Wordmark className="text-[32px] leading-[42px] tracking-[0.1em]" />
        </Link>
        <h1 className="mt-[90px] text-center text-xl leading-6 font-bold text-cream">{mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</h1>
        <p className="sr-only">{subtitle}</p>
        <div className="mt-8 flex flex-col gap-6">
          {mode === 'login' ? <LoginForm redirect={redirect} reason={reason} mobile /> : <RegisterForm redirect={redirect} mobile />}
          <SocialButtons mobile />
        </div>
        <p className="mt-12 text-center text-[15px] text-sand">
          {mode === 'login' ? (
            <>
              Novo na Kurio?{' '}
              <Link to="/cadastro" search={{ redirect }} className="text-sand underline-offset-4 hover:text-brand-light hover:underline">
                Crie uma conta
              </Link>
            </>
          ) : (
            <>
              Já tem uma conta?{' '}
              <Link to="/entrar" search={{ redirect }} className="text-sand underline-offset-4 hover:text-brand-light hover:underline">
                Entre
              </Link>
            </>
          )}
        </p>
      </main>
    )
  }

  return (
    <>
      <div inert>
        <HomePage search={{}} />
      </div>
      <Dialog open onOpenChange={(open) => !open && void navigate({ href: safeRedirect(redirect === '/pagamento' ? '/carrinho' : redirect), replace: true })}>
        <DialogContent className="w-[500px] max-w-[calc(100%-2rem)] gap-0 border-b-[10px] border-brand p-0 pb-14 sm:max-w-[500px]">
          <div className="flex flex-col items-center gap-10 px-12 pt-12">
            <DialogTitle asChild>
              <h1>
                <ModeSwitch mode={mode} redirect={redirect} />
              </h1>
            </DialogTitle>
            <DialogDescription className="text-center text-[13px] leading-4 text-cream">{subtitle}</DialogDescription>
          </div>
          <div className="flex flex-col gap-6 px-20 pt-6">
            {mode === 'login' ? <LoginForm redirect={redirect} reason={reason} mobile={false} /> : <RegisterForm redirect={redirect} mobile={false} />}
          </div>
          <div className="pt-6">
            <SocialButtons mobile={false} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
