// Converte os SVGs exportados do Figma (design/icons) em componentes React (src/components/icons/),
// um arquivo por ícone para que cada rota carregue apenas os ícones que usa.
// Cores sólidas viram `currentColor` para herdar a cor do texto; logos de marca mantêm as cores.
// Uso: node scripts/build-icons.mjs
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

const ICONS = {
  Search: 'search', Cart: 'cart', Logout: 'logout', ChevronDown: 'chevron-down', ArrowRight: 'arrow-right',
  ArrowRight2: 'arrow-right-2', ArrowLeft2: 'arrow-left-2', Delete: 'delete', Filter: 'filter', Hide: 'hide',
  ImageIcon: 'image', Wallet: 'wallet', Location: 'location', Activity: 'activity', Danger: 'danger',
  Download: 'download', User: 'user', Shopping: 'shopping', Heart: 'heart', Zoom: 'card-zoom', Star: 'star',
  Linkedin: 'linkedin', Message: 'message', Twitter: 'twitter', SocialFacebook: 'social-facebook',
  SocialInstagram: 'social-instagram', SocialTwitter: 'social-twitter', SocialLinkedin: 'social-linkedin',
  SocialYoutube: 'social-youtube', Close: 'close', SelectArrow: 'select-arrow', TabHome: 'tab-home',
  TabUser: 'tab-user', TabShop: 'tab-shop', TabHeart: 'tab-heart', TabScan: 'tab-scan',
  GoogleLogo: 'google', FacebookLogo: 'facebook', ThankYou: 'thank-you',
}
const KEEP_COLORS = new Set(['google', 'facebook'])

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

const HEADER = '// Gerado por scripts/build-icons.mjs a partir dos ícones do Figma. Não editar manualmente.\n'
await rm('src/components/icons', { recursive: true, force: true })
await rm('src/components/icons.tsx', { force: true })
await mkdir('src/components/icons', { recursive: true })
let index = HEADER
for (const [name, file] of Object.entries(ICONS)) {
  let svg = await readFile(`design/icons/${file}.svg`, 'utf8')
  const [, attrs, body] = svg.match(/<svg([^>]*)>([\s\S]*)<\/svg>/)
  const viewBox = attrs.match(/viewBox="([^"]+)"/)[1]
  const [, , w, h] = viewBox.split(' ')
  let inner = body.trim()
  if (!KEEP_COLORS.has(file)) {
    inner = inner.replace(/(fill|stroke)="(#[0-9A-Fa-f]{3,8})"/g, '$1="currentColor"')
  }
  inner = inner
    .replace(/\s([a-z]+(?:-[a-z]+)+)=/g, (_, a) => ` ${camel(a)}=`)
    .replace(/\sxlink:href=/g, ' href=')
    .replace(/style="mask-type:luminance"/g, "style={{ maskType: 'luminance' }}")
    .replace(/\n/g, '\n    ')
  index += `export { ${name} } from './${file}'\n`
  await writeFile(`src/components/icons/${file}.tsx`, `${HEADER}import type { SVGProps } from 'react'

export function ${name}(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={${w}} height={${h}} viewBox="${viewBox}" fill="none" aria-hidden="true" focusable="false" {...props}>
    ${inner}
    </svg>
  )
}
`)
}
await writeFile('src/components/icons/index.ts', index)
console.log('icons:', Object.keys(ICONS).length)
