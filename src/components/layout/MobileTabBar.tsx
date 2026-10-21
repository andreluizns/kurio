import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { TabHeart, TabHome, TabScan, TabShop, TabUser } from '@/components/icons'
import { useCart } from '@/features/cart/use-cart'
import { useCurrentUser } from '@/features/auth/use-auth'
import { cn } from '@/lib/utils'
import { SearchDialog } from './SearchDialog'

const itemClass = 'relative flex size-11 items-center justify-center text-sand'

/** Barra de navegação inferior do layout mobile (forma com recorte central exportada do Figma). */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const user = useCurrentUser()
  const { data: cart } = useCart()
  const [searchOpen, setSearchOpen] = useState(false)
  const count = cart?.items.length ?? 0
  const active = (path: string) => pathname === path

  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 h-[126px] md:hidden">
      <svg
        aria-hidden
        className="absolute bottom-0 h-[95px] w-full drop-shadow-[0_-10px_30px_rgb(10_6_4/0.45)]"
        viewBox="30 40 414 95"
        preserveAspectRatio="none"
      >
        <path
          d="M312.85 40C299.09 40 286.87 48.2 281.02 60.65C273.26 77.17 256.46 88.62 237 88.62C217.54 88.62 200.74 77.18 192.98 60.65C187.13 48.2 174.9 40 161.15 40H58.93C42.95 40 30 52.95 30 68.93V134.95H444V68.93C444 52.95 431.05 40 415.07 40H312.85Z"
          fill="var(--color-surface)"
        />
      </svg>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <button
          type="button"
          aria-label="Buscar NFTs"
          className="absolute top-0 left-1/2 flex size-[65px] -translate-x-1/2 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgb(210_138_76/0.4),#d28a4c)] text-cream"
        >
          <TabScan className="h-6 w-[27px]" />
        </button>
      </SearchDialog>
      <ul className="absolute inset-x-0 bottom-0 flex h-[95px] items-center justify-between px-6 pt-6">
        <li>
          <Link to="/" aria-label="Início" aria-current={active('/') ? 'page' : undefined} className={cn(itemClass, active('/') && 'text-brand-light')}>
            <TabHome className="size-5" />
          </Link>
        </li>
        <li className="mr-auto ml-6">
          <Link to="/conta/favoritos" aria-label="Lista de interesse" className={cn(itemClass, active('/conta/favoritos') && 'text-brand-light')}>
            <TabHeart className="h-[18px] w-5" />
          </Link>
        </li>
        <li className="mr-6">
          <Link to="/carrinho" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} className={itemClass}>
            <TabShop className="size-5" />
            {count > 0 && (
              <span aria-hidden className="absolute top-1 right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-surface bg-brand text-[10px] font-medium text-ink">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>
        </li>
        <li>
          <Link
            to={user ? '/conta/perfil' : '/entrar'}
            aria-label={user ? 'Meu perfil' : 'Entrar'}
            className={cn(itemClass, pathname.startsWith('/conta/perfil') && 'text-brand-light')}
          >
            <TabUser className="size-5" />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
