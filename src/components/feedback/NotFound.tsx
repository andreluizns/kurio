import { Link } from '@tanstack/react-router'
import { PageShell } from '@/components/layout/PageShell'

export function NotFound({ title = 'Página não encontrada', description }: { title?: string; description?: string }) {
  return (
    <PageShell>
      <section className="flex flex-col items-center gap-4 py-24 text-center" aria-labelledby="not-found-title">
        <p className="text-sm font-bold tracking-[0.1em] text-brand-light">ERRO 404</p>
        <h1 id="not-found-title" className="text-2xl font-bold text-cream md:text-[28px]">
          {title}
        </h1>
        <p className="max-w-md text-sm leading-6 text-sand">
          {description ?? 'O endereço acessado não existe ou foi removido. Confira o link ou volte para o mercado.'}
        </p>
        <Link to="/" className="mt-2 rounded-md bg-brand px-6 py-2.5 text-sm font-bold text-ink hover:bg-brand-light">
          Voltar ao início
        </Link>
      </section>
    </PageShell>
  )
}
