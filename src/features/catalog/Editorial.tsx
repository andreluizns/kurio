import { Link } from '@tanstack/react-router'
import type { ArtworkKey } from '@/api/contracts'
import { ArrowRight } from '@/components/icons'
import { NftArtwork } from '@/components/nft/NftArtwork'
import { comingSoon } from '@/lib/coming-soon'

const PROMOS: { title: string; text: string; artwork: ArtworkKey; search: Record<string, string> }[] = [
  {
    title: 'Lançamentos gênesis\nde edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    artwork: 'emerald',
    search: { tab: 'novos' },
  },
  {
    title: 'Arte digital selecionada\ne muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    artwork: 'baron',
    search: { collections: 'arte-digital' },
  },
]

const POSTS: { date: string; read: string; title: string; text: string; artwork: ArtworkKey }[] = [
  { date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', artwork: 'baron' },
  { date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', artwork: 'emerald' },
  { date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', artwork: 'nomad' },
  { date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', artwork: 'golden' },
]

export function Promos() {
  return (
    <section aria-label="Coleções em destaque" className="grid gap-7 lg:grid-cols-2">
      {PROMOS.map((promo) => (
        <article key={promo.title} className="relative flex h-[250px] overflow-hidden rounded-lg bg-surface">
          <span aria-hidden className="pointer-events-none absolute -bottom-[150px] left-[-191px] size-64 rounded-full border-2 border-brand" />
          <span aria-hidden className="pointer-events-none absolute -bottom-[142px] left-[-199px] size-64 rounded-full border border-brand" />
          <NftArtwork artwork={promo.artwork} alt="" sizes="292px" className="h-full w-[45%] max-w-[292px] shrink-0 rounded-[18px]" />
          <div className="relative flex flex-1 flex-col items-end justify-between py-9 pr-5 pl-3 text-right sm:pr-[30px]">
            <div className="flex flex-col items-end gap-2">
              <h3 className="text-base leading-6 font-bold whitespace-pre-line text-cream sm:text-lg">{promo.title}</h3>
              <p className="max-w-[263px] text-sm leading-6 text-sand">{promo.text}</p>
            </div>
            <Link
              to="/"
              search={promo.search}
              hash="catalogo"
              className="flex h-10 w-[140px] items-center justify-center gap-0 rounded-md bg-brand text-sm leading-5 font-medium text-ink hover:bg-brand-light"
            >
              Explorar <ArrowRight className="ml-0.5 size-[18px]" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

export function Blog() {
  return (
    <section aria-labelledby="blog-title" className="flex flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 id="blog-title" className="text-[28px] leading-[37px] font-bold text-cream">
          Diário da Cunhagem
        </h2>
        <p className="text-sm leading-[18px] text-sand">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </div>
      <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <article key={post.title} className="flex flex-col overflow-hidden rounded-lg bg-surface">
            <NftArtwork artwork={post.artwork} alt="" sizes="268px" className="aspect-[268/195] w-full" />
            <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
              <p className="text-xs leading-4 font-medium text-sand">
                {post.date}&nbsp;&nbsp;|&nbsp;&nbsp;Leitura de {post.read}
              </p>
              <h3 className="text-base leading-[21px] font-bold text-cream">{post.title}</h3>
              <p className="text-xs leading-4 font-medium text-sand">{post.text}</p>
              <button
                type="button"
                onClick={() => comingSoon('O Diário da Cunhagem')}
                className="mt-auto flex w-fit items-center gap-1 text-xs leading-[14px] font-bold text-brand-light hover:underline"
              >
                Ler mais <span aria-hidden>→</span>
                <span className="sr-only">: {post.title}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
