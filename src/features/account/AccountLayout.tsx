import type { ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Activity, Danger, Download, Heart, Location, Logout, Shopping, User } from '@/components/icons'
import { PageShell } from '@/components/layout/PageShell'
import { useLogout } from '@/features/auth/use-auth'
import { comingSoon } from '@/lib/coming-soon'
import { cn } from '@/lib/utils'

const ITEMS = [
  { label: 'Dados do perfil', to: '/conta/perfil', Icon: User },
  { label: 'Carteiras', to: '/conta/carteiras', Icon: Location },
  { label: 'Atividade', Icon: Shopping },
  { label: 'Lista de interesse', to: '/conta/favoritos', Icon: Heart },
  { label: 'Ofertas', Icon: Activity },
  { label: 'Arquivos baixados', Icon: Download },
  { label: 'Suporte', Icon: Danger },
] as const

export function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()
  const navigate = useNavigate()
  const itemClass = 'flex h-[45px] w-full items-center gap-3 border-l-[6px] border-transparent pr-4 pl-2.5 text-[15px] leading-[15px] whitespace-nowrap text-brand-light'

  return (
    <PageShell divider footer={false} className="pt-8">
      <div className="flex flex-col gap-7 lg:flex-row">
        <nav aria-labelledby="account-nav-title" className="shrink-0 bg-surface lg:w-[310px] lg:self-start">
          <h2 id="account-nav-title" className="px-2.5 pt-5 pb-2 text-lg leading-5 font-bold text-cream">
            Meu perfil
          </h2>
          <ul className="flex overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {ITEMS.map(({ label, Icon, ...rest }) => {
              const to = 'to' in rest ? rest.to : undefined
              const active = to === pathname
              return (
                <li key={label} className="shrink-0">
                  {to ? (
                    <Link to={to} aria-current={active ? 'page' : undefined} className={cn(itemClass, active && 'border-brand')}>
                      <Icon className="size-[18px] shrink-0" />
                      {label}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => comingSoon(label)} className={cn(itemClass, 'text-brand-light/90')}>
                      <Icon className="size-[18px] shrink-0 text-khaki" />
                      {label}
                    </button>
                  )}
                </li>
              )
            })}
            <li className="shrink-0 lg:border-t lg:border-line">
              <button
                type="button"
                onClick={() => logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })}
                className={cn(itemClass, 'h-10 font-bold')}
              >
                <Logout className="size-5 shrink-0" />
                Sair
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </PageShell>
  )
}
