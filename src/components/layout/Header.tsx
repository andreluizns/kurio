import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useCart } from '@/features/cart/use-cart'
import { useCurrentUser, useLogout } from '@/features/auth/use-auth'
import { Cart as CartIcon, Logout, Search, User as UserIcon } from '@/components/icons'
import { comingSoon } from '@/lib/coming-soon'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SearchDialog } from './SearchDialog'

const MARKET_PATHS = ['/nft', '/carrinho', '/pagamento', '/pedido']

function NavItem({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className="relative flex h-[45px] flex-col">
      <span className={cn('text-base leading-[21px]', active ? 'font-bold text-brand-light' : 'text-cream')}>{children}</span>
      {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-brand" />}
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn('text-sm leading-[18px] font-bold tracking-[0.1em] text-cream', className)}>KURIO</span>
}

export function Header({ divider = false }: { divider?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const href = useRouterState({ select: (s) => s.location.href })
  const user = useCurrentUser()
  const { data: cart } = useCart()
  const logout = useLogout()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const count = cart?.items.length ?? 0
  const inMarket = MARKET_PATHS.some((p) => pathname.startsWith(p))
  const isHome = pathname === '/' && !inMarket

  return (
    <header className={cn('mx-auto w-full max-w-page', divider && 'border-b border-brand/30')}>
      <div className="flex h-[45px] items-start justify-between gap-4">
        <Link to="/" className="mt-2 flex h-[18px] w-40 items-center" aria-label="Kurio — página inicial">
          <Wordmark />
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex gap-6 lg:gap-10">
            <li>
              <Link to="/" aria-current={isHome ? 'page' : undefined}>
                <NavItem active={isHome}>Início</NavItem>
              </Link>
            </li>
            <li>
              <Link to="/" hash="catalogo" aria-current={inMarket ? 'page' : undefined}>
                <NavItem active={inMarket}>Mercado</NavItem>
              </Link>
            </li>
            <li>
              <button type="button" onClick={() => comingSoon('Criadores')}>
                <NavItem active={false}>Criadores</NavItem>
              </button>
            </li>
            <li>
              <button type="button" onClick={() => comingSoon('Aprenda')}>
                <NavItem active={false}>Aprenda</NavItem>
              </button>
            </li>
          </ul>
        </nav>

        <div className="flex h-[35px] items-center gap-5 md:gap-7">
          <SearchDialog open={searchOpen} onOpenChange={setSearchOpen}>
            <button type="button" className="flex size-8 items-center justify-center text-cream hover:text-brand-light" aria-label="Buscar NFTs">
              <Search className="size-5" />
            </button>
          </SearchDialog>
          <Link
            to="/carrinho"
            className="relative flex size-8 items-center justify-center text-cream hover:text-brand-light"
            aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
          >
            <CartIcon className="h-6 w-[25px]" />
            {count > 0 && (
              <span
                aria-hidden
                data-testid="cart-badge"
                className="absolute -top-0.5 -right-1 flex size-4 items-center justify-center rounded-full border-2 border-ink bg-brand text-[10px] leading-[13px] font-medium text-ink"
              >
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-[35px] max-w-[160px] items-center gap-1 rounded-md bg-brand px-2.5 text-base font-medium text-ink"
                aria-label={`Conta de ${user.displayName}`}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="size-5 rounded-full object-cover" />
                ) : (
                  <UserIcon className="size-5" />
                )}
                <span className="hidden truncate sm:inline">{user.displayName.split(' ')[0]}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: '/conta/perfil' })}>Dados do perfil</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate({ to: '/conta/carteiras' })}>Carteiras</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate({ to: '/conta/favoritos' })}>Lista de interesse</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => logout.mutate(undefined, { onSettled: () => navigate({ to: '/' }) })}
                >
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/entrar"
              search={{ redirect: href }}
              className="flex h-[35px] w-[100px] items-center justify-center gap-1 rounded-md bg-brand text-base leading-[21px] font-medium text-ink hover:bg-brand-light"
            >
              <Logout className="size-5" />
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
