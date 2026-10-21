import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Footer } from './Footer'
import { Header } from './Header'

/**
 * Estrutura comum das páginas desktop: cabeçalho, conteúdo (container de 1200 px) e rodapé.
 * `mobileChrome={false}` oculta cabeçalho/rodapé em telas pequenas, para páginas com layout mobile próprio.
 */
export function PageShell({
  children,
  footer = true,
  divider = false,
  mobileChrome = true,
  className,
}: {
  children: ReactNode
  footer?: boolean
  divider?: boolean
  mobileChrome?: boolean
  className?: string
}) {
  return (
    <div className="flex min-h-dvh flex-col px-4 pt-6 pb-6 sm:px-6 lg:px-[120px]">
      <div className={cn(!mobileChrome && 'hidden md:block')}>
        <Header divider={divider} />
      </div>
      <main id="conteudo" tabIndex={-1} className={cn('mx-auto w-full max-w-page flex-1 focus:outline-none', className)}>
        {children}
      </main>
      {footer && (
        <div className={cn('mt-24', !mobileChrome && 'hidden md:block')}>
          <Footer />
        </div>
      )}
    </div>
  )
}
