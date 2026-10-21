import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { CollectionSlug } from '@/api/contracts'
import {
  SocialFacebook,
  SocialInstagram,
  SocialLinkedin,
  SocialTwitter,
  SocialYoutube,
} from '@/components/icons'
import { comingSoon } from '@/lib/coming-soon'
import { Wordmark } from './Header'

const SERVICES = [
  { mark: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { mark: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { mark: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const FOOTER_COLLECTIONS: { slug: CollectionSlug; label: string }[] = [
  { slug: 'arte-digital', label: 'Arte digital' },
  { slug: 'fotografia', label: 'Fotografia' },
  { slug: 'musica', label: 'Música' },
  { slug: 'arte-3d', label: 'Arte 3D' },
  { slug: 'utilidade', label: 'Utilidade' },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com', Icon: SocialFacebook },
  { label: 'Instagram', href: 'https://www.instagram.com', Icon: SocialInstagram },
  { label: 'X (Twitter)', href: 'https://x.com', Icon: SocialTwitter },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', Icon: SocialLinkedin },
  { label: 'YouTube', href: 'https://www.youtube.com', Icon: SocialYoutube },
]

const linkClass = 'text-left text-sm leading-[30px] text-cream hover:text-brand-light'

function SoonLink({ label }: { label: string }) {
  return (
    <li>
      <button type="button" className={linkClass} onClick={() => comingSoon(label)}>
        {label}
      </button>
    </li>
  )
}

function Newsletter() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          setError('Informe um e-mail válido.')
          return
        }
        setError(null)
        comingSoon('A inscrição em alertas')
      }}
    >
      <h2 className="text-lg leading-4 font-bold text-cream">Antecipe-se ao próximo lançamento</h2>
      <div className="flex h-10 items-center justify-between rounded-md bg-band pl-3 shadow-glow">
        <label htmlFor={id} className="sr-only">
          E-mail para alertas de lançamentos
        </label>
        <input
          id={id}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent text-sm text-cream placeholder:text-khaki focus:outline-none"
        />
        <button type="submit" className="h-10 rounded-r-md bg-brand px-4 text-lg leading-4 font-bold text-ink hover:bg-brand-light">
          Enviar
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-coral">
          {error}
        </p>
      )}
      <p className="text-[13px] leading-[22px] text-sand">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
    </form>
  )
}

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-page">
      <div className="bg-surface p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,265px))_minmax(0,1fr)] lg:gap-0">
          {SERVICES.map((s) => (
            <div key={s.mark} className="flex flex-col gap-3 lg:border-r lg:border-brand lg:px-4">
              <span aria-hidden className="flex size-[74px] items-center justify-center rounded-full bg-brand text-2xl leading-8 font-bold text-ink">
                {s.mark}
              </span>
              <h2 className="text-[17px] leading-4 font-bold text-cream">{s.title}</h2>
              <p className="max-w-[204px] text-sm leading-[22px] text-sand">{s.text}</p>
            </div>
          ))}
          <div className="lg:pl-4">
            <Newsletter />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-4 bg-band p-6 sm:grid-cols-2 md:p-8 lg:grid-cols-4 lg:gap-0">
        <Wordmark />
        <p className="text-sm leading-[22px] text-cream">
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <a href="mailto:contato@email.com" className="text-sm leading-[22px] text-cream hover:text-brand-light">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="text-sm leading-[22px] text-cream hover:text-brand-light">
          +55 11 4002 8922
        </a>
      </div>

      <div className="bg-surface p-6 md:p-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          <nav aria-labelledby="footer-profile">
            <h2 id="footer-profile" className="mb-2 text-lg leading-4 font-bold text-cream">
              Meu perfil
            </h2>
            <ul>
              <li>
                <Link to="/conta/perfil" className={linkClass}>
                  Meu perfil
                </Link>
              </li>
              <SoonLink label="Minha coleção" />
              <SoonLink label="Atividade" />
              <SoonLink label="Estúdio do criador" />
              <li>
                <Link to="/conta/favoritos" className={linkClass}>
                  Lista de interesse
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-help">
            <h2 id="footer-help" className="mb-2 text-lg leading-4 font-bold text-cream">
              Central de ajuda
            </h2>
            <ul>
              <SoonLink label="Central de ajuda" />
              <SoonLink label="Como comprar NFTs" />
              <SoonLink label="Carteira e segurança" />
              <SoonLink label="Política do mercado" />
              <SoonLink label="Denunciar item" />
            </ul>
          </nav>
          <nav aria-labelledby="footer-collections">
            <h2 id="footer-collections" className="mb-2 text-lg leading-4 font-bold text-cream">
              Coleções
            </h2>
            <ul>
              {FOOTER_COLLECTIONS.map((c) => (
                <li key={c.slug}>
                  <Link to="/" search={{ collections: c.slug }} hash="catalogo" className={linkClass}>
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <h2 className="text-lg leading-4 font-bold text-cream">Redes sociais</h2>
              <ul className="flex items-center gap-2.5">
                {SOCIAL.map(({ label, href, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label} (abre em nova aba)`}
                      className="flex size-[30px] items-center justify-center rounded border border-brand text-brand hover:bg-brand/10"
                    >
                      <Icon className="max-h-4 max-w-[19px]" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-lg leading-4 font-bold text-cream">Carteiras compatíveis</h2>
              <WalletBrands />
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-sm leading-[30px] text-cream">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

export function WalletBrands({ className = '' }: { className?: string }) {
  return (
    <p
      className={`inline-flex h-[26px] w-fit items-center rounded-md border border-line-2 bg-band px-2 text-[9px] leading-3 font-bold tracking-[0.01em] whitespace-nowrap text-brand-light ${className}`}
    >
      METAMASK&nbsp;&nbsp;•&nbsp;&nbsp;WALLETCONNECT&nbsp;&nbsp;•&nbsp;&nbsp;COINBASE
    </p>
  )
}
