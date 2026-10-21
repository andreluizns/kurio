import type {
  ArtworkKey,
  CollectionSlug,
  Network,
  NftDetail,
  NftEdition,
  User,
  Wallet,
} from '@/api/contracts'
import { mul, normalize } from '@/lib/money'

/** Instante de referência das fixtures: datas determinísticas independentes do relógio real. */
export const SEED_NOW = Date.UTC(2026, 6, 29, 12, 0, 0)

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Contagens por coleção iguais às do layout.
const COLLECTION_COUNTS: Record<CollectionSlug, number> = {
  'arte-digital': 33,
  fotografia: 12,
  musica: 65,
  'arte-3d': 39,
  colecionaveis: 23,
  generativa: 17,
  jogos: 19,
  assinaturas: 13,
  utilidade: 18,
}

const COLLECTION_NAMES: Record<CollectionSlug, string> = {
  'arte-digital': 'Kurio Apes',
  fotografia: 'Lens Primates',
  musica: 'Golden Frequencies',
  'arte-3d': 'Kurio Sculpt',
  colecionaveis: 'Kurio Editions',
  generativa: 'Generative Grove',
  jogos: 'Arcade Apes',
  assinaturas: 'Kurio Pass',
  utilidade: 'Utility Club',
}

const FAMILIES: Record<ArtworkKey, { nouns: string[]; attributes: string[] }> = {
  emerald: { nouns: ['Ape', 'Shade', 'Varsity', 'Jewel'], attributes: ['Óculos', 'Esmeralda', 'Jaqueta'] },
  nomad: { nouns: ['Nomad', 'Bloom', 'Drifter', 'Hood'], attributes: ['Chapéu', 'Moletom', 'Lilás'] },
  baron: { nouns: ['Baron', 'Vessel', 'Duke', 'Noir'], attributes: ['Gola alta', 'Blazer', 'Ônix'] },
  golden: { nouns: ['Beat', 'Signal', 'Frequency', 'Rhythm'], attributes: ['Fones', 'Dourado', 'Som'] },
}

const ADJECTIVES = [
  'Amber', 'Crimson', 'Onyx', 'Copper', 'Velvet', 'Lunar', 'Solar', 'Rustic', 'Silent', 'Hidden',
  'Wild', 'Royal', 'Misty', 'Bright', 'Dusty', 'Frozen', 'Hollow', 'Iron', 'Jade', 'Coral',
  'Ember', 'Rapid', 'Quiet', 'Stellar', 'Urban', 'Vivid', 'Mellow', 'Noble', 'Pale', 'Scarlet',
]

const ARTWORKS: ArtworkKey[] = ['emerald', 'nomad', 'baron', 'golden']

interface FeaturedSpec {
  name: string
  number: number
  artwork: ArtworkKey
  price: string
  previousPrice?: string
  rarity?: 'raro'
  collection: CollectionSlug
  network: Network
}

// Primeira página do catálogo (ordenação "Listados recentemente"), conforme o layout.
const FEATURED: FeaturedSpec[] = [
  { name: 'Emerald Ape', number: 42, artwork: 'emerald', price: '1.19', collection: 'arte-digital', network: 'ethereum' },
  { name: 'Sage Nomad', number: 9, artwork: 'nomad', price: '1.69', collection: 'arte-digital', network: 'ethereum' },
  { name: 'Neon Vessel', number: 552, artwork: 'baron', price: '1.99', previousPrice: '2.29', rarity: 'raro', collection: 'arte-digital', network: 'polygon' },
  { name: 'Cosmic Bloom', number: 118, artwork: 'nomad', price: '1.29', collection: 'generativa', network: 'ethereum' },
  { name: 'Violet Nomad', number: 314, artwork: 'nomad', price: '1.39', collection: 'colecionaveis', network: 'ethereum' },
  { name: 'Ivory Baron', number: 88, artwork: 'baron', price: '1.79', collection: 'colecionaveis', network: 'ethereum' },
  { name: 'Golden Beat', number: 207, artwork: 'golden', price: '0.99', collection: 'musica', network: 'solana' },
  { name: 'Golden Frequency', number: 71, artwork: 'golden', price: '0.59', collection: 'musica', network: 'solana' },
  { name: 'Golden Signal', number: 160, artwork: 'golden', price: '0.39', collection: 'musica', network: 'polygon' },
]

const pad = (n: number, size: number) => String(n).padStart(size, '0')

const REVIEWERS = ['Lia Moreira', 'Caio Tanaka', 'Marina Alves', 'Rafael Couto', 'Júlia Prado', 'Theo Ramos']
const REVIEW_TEXTS = [
  'Arte impecável e procedência clara. A entrega na carteira foi imediata.',
  'Os detalhes em alta resolução são incríveis. Vale cada ETH.',
  'Ótima curadoria da Kurio. Já estou de olho no próximo lançamento da coleção.',
  'Comprei a edição 1/50 e o acesso aos conteúdos exclusivos funcionou sem problemas.',
  'Paleta linda e atributos raros. Uma das peças favoritas da minha coleção.',
]

function buildReviews(id: string, rand: () => number) {
  return Array.from({ length: 3 }, (_, i) => ({
    id: `${id}-review-${i + 1}`,
    author: REVIEWERS[Math.floor(rand() * REVIEWERS.length)],
    rating: rand() < 0.75 ? 5 : 4,
    date: new Date(SEED_NOW - (i + 1) * 3 * 86400_000).toISOString(),
    text: REVIEW_TEXTS[Math.floor(rand() * REVIEW_TEXTS.length)],
  }))
}

function buildEditions(id: string, basePrice: string, rand: () => number, soldOut1of1: boolean): NftEdition[] {
  const taken10 = Math.floor(rand() * 6)
  const taken50 = Math.floor(rand() * 30)
  return [
    { id: `${id}-1-1`, label: '1/1', price: normalize(mul(basePrice, 4)), available: soldOut1of1 ? 0 : 1, supply: 1 },
    { id: `${id}-1-10`, label: '1/10', price: normalize(mul(basePrice, '1.5')), available: 10 - taken10, supply: 10 },
    { id: `${id}-1-50`, label: '1/50', price: basePrice, available: 50 - taken50, supply: 50 },
    { id: `${id}-aberta`, label: 'ABERTA', price: normalize(mul(basePrice, '0.8')), available: 999, supply: null },
  ]
}

function buildNft(
  index: number,
  spec: {
    name: string
    number: number
    artwork: ArtworkKey
    price: string
    previousPrice?: string
    rarity?: 'raro'
    collection: CollectionSlug
    network: Network
  },
  rand: () => number,
): NftDetail {
  const id = `nft-${spec.name.toLowerCase().replace(/\s+/g, '-')}-${pad(spec.number, 3)}`
  const family = FAMILIES[spec.artwork]
  const editions = buildEditions(id, spec.price, rand, index % 7 === 1)
  const fullName = `${spec.name} #${pad(spec.number, 3)}`
  const collectionName = COLLECTION_NAMES[spec.collection]
  const networkLabel = spec.network === 'ethereum' ? 'Ethereum' : spec.network === 'polygon' ? 'Polygon' : 'Solana'
  return {
    id,
    name: fullName,
    tokenId: `#${pad(spec.number, 4)}`,
    artwork: spec.artwork,
    collection: spec.collection,
    network: spec.network,
    price: spec.price,
    previousPrice: spec.previousPrice ?? null,
    rarity: spec.rarity ?? null,
    // Um item a cada 6 horas, do mais recente para o mais antigo.
    listedAt: new Date(SEED_NOW - index * 6 * 3600_000).toISOString(),
    available: editions.reduce((acc, e) => acc + e.available, 0),
    version: 1,
    description: `Um colecionável digital finalizado à mão da coleção ${collectionName}, verificado na ${networkLabel}, com arte desbloqueável e acesso para colecionadores.`,
    story: [
      `${fullName} é uma obra digital 1/50 finalizada à mão da coleção ${collectionName}. Cada atributo fica armazenado nos metadados do token e verificado na ${networkLabel}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    ],
    collectionName,
    attributes: [...family.attributes.slice(0, 2), spec.rarity === 'raro' || index % 5 === 0 ? 'Raro' : 'Comum'],
    rating: Math.round((4 + rand()) * 10) / 10,
    reviewsCount: 5 + Math.floor(rand() * 40),
    reviews: buildReviews(id, rand),
    contract: `0x${pad(spec.number, 4)}A42…19E8`,
    royaltiesPercent: 5,
    defaultEditionId: `${id}-1-50`,
    editions,
    maxPerOrder: 10,
  }
}

export function seedNfts(): NftDetail[] {
  const rand = mulberry32(20260729)
  const nfts: NftDetail[] = []
  const usedNames = new Set<string>()
  const remaining = { ...COLLECTION_COUNTS }
  const networks: Network[] = ['ethereum', 'polygon', 'solana']

  FEATURED.forEach((spec, i) => {
    remaining[spec.collection] -= 1
    usedNames.add(`${spec.name} ${spec.number}`)
    nfts.push(buildNft(i, spec, rand))
  })

  // Ajustes do Emerald Ape para corresponder exatamente ao layout de detalhe.
  const emerald = nfts[0]
  emerald.rating = 4.8
  emerald.reviewsCount = 19
  emerald.attributes = ['Óculos', 'Esmeralda', 'Raro']
  emerald.contract = '0x7A42…19E8'
  emerald.collectionName = 'Kurio Apes'
  emerald.description =
    'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.'
  emerald.story[0] =
    'Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.'

  let index = FEATURED.length
  const collections = (Object.keys(remaining) as CollectionSlug[]).flatMap((c) => Array<CollectionSlug>(remaining[c]).fill(c))
  // Embaralhamento determinístico para distribuir as coleções na linha do tempo.
  for (let i = collections.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[collections[i], collections[j]] = [collections[j], collections[i]]
  }

  for (const collection of collections) {
    const artwork = ARTWORKS[Math.floor(rand() * ARTWORKS.length)]
    const family = FAMILIES[artwork]
    let name: string
    let number: number
    do {
      name = `${ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]} ${family.nouns[Math.floor(rand() * family.nouns.length)]}`
      number = 1 + Math.floor(rand() * 998)
    } while (usedNames.has(`${name} ${number}`))
    usedNames.add(`${name} ${number}`)

    // Distribuição de preços entre 0.02 e 12.30 ETH, com extremos garantidos.
    const isFirst = index === FEATURED.length
    const isLast = index === FEATURED.length + collections.length - 1
    const raw = isFirst ? 12.3 : isLast ? 0.02 : 0.05 + Math.pow(rand(), 2.2) * 11
    const price = normalize(raw.toFixed(2))
    const discounted = rand() < 0.08
    nfts.push(
      buildNft(
        index,
        {
          name,
          number,
          artwork,
          price,
          previousPrice: discounted ? normalize((raw * 1.15).toFixed(2)) : undefined,
          rarity: rand() < 0.12 ? 'raro' : undefined,
          collection,
          network: networks[Math.floor(rand() * networks.length)],
        },
        rand,
      ),
    )
    index++
  }
  return nfts
}

export interface SeedUser extends User {
  password: string
}

export const SEED_USERS: SeedUser[] = [
  {
    id: 'usr_ana',
    username: 'ana.sato',
    displayName: 'Ana Sato',
    email: 'ana@kurio.dev',
    ensName: 'anasato',
    ensSuffix: '.eth',
    walletNickname: 'Principal',
    avatarUrl: null,
    password: 'Kurio@2026',
  },
  {
    id: 'usr_bruno',
    username: 'bruno.lima',
    displayName: 'Bruno Lima',
    email: 'bruno@kurio.dev',
    ensName: 'brunolima',
    ensSuffix: '.eth',
    walletNickname: 'Cofre',
    avatarUrl: null,
    password: 'Kurio@2026',
  },
]

const seedDate = new Date(SEED_NOW).toISOString()

export const SEED_WALLETS: Record<string, { primary: Wallet | null; secondary: Wallet | null }> = {
  usr_ana: {
    primary: {
      slot: 'primary',
      displayName: 'Ana Sato',
      nickname: 'Principal',
      network: 'ethereum',
      profileName: 'anasato',
      address: '0xA91F3c5D7e2B4a6C8d0E1f2A3b4C5d6E7f80E82C',
      secondaryAddress: '',
      provider: 'metamask',
      referralCode: 'KURIO-ANA',
      email: 'ana@kurio.dev',
      ensName: 'anasato',
      ensSuffix: '.eth',
      updatedAt: seedDate,
    },
    secondary: {
      slot: 'secondary',
      displayName: 'Ana Sato',
      nickname: 'Reserva',
      network: 'polygon',
      profileName: 'nova',
      address: '0x5B2e8A1c9D3f4E6a7B8c9D0e1F2a3B4c5D6e7F81',
      secondaryAddress: 'nova.kurio.eth',
      provider: 'coinbase',
      referralCode: 'KURIO-ANA',
      email: 'ana@kurio.dev',
      ensName: 'nova',
      ensSuffix: '.kurio.eth',
      updatedAt: seedDate,
    },
  },
  usr_bruno: {
    primary: {
      slot: 'primary',
      displayName: 'Bruno Lima',
      nickname: 'Cofre',
      network: 'ethereum',
      profileName: 'brunolima',
      address: '0x3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b1C2D',
      secondaryAddress: '',
      provider: 'walletconnect',
      referralCode: 'KURIO-BRUNO',
      email: 'bruno@kurio.dev',
      ensName: 'brunolima',
      ensSuffix: '.eth',
      updatedAt: seedDate,
    },
    secondary: null,
  },
}

export const SEED_FAVORITES: Record<string, string[]> = {
  usr_ana: ['nft-emerald-ape-042', 'nft-neon-vessel-552'],
  usr_bruno: ['nft-golden-beat-207'],
}

/** Carrinho inicial da Ana, igual ao layout do carrinho (Emerald ×2, Violet ×6, Ivory ×9). */
export const SEED_CARTS: Record<string, { nftId: string; editionLabel: string; quantity: number }[]> = {
  usr_ana: [
    { nftId: 'nft-emerald-ape-042', editionLabel: '1/50', quantity: 2 },
    { nftId: 'nft-violet-nomad-314', editionLabel: '1/50', quantity: 6 },
    { nftId: 'nft-ivory-baron-088', editionLabel: '1/50', quantity: 9 },
  ],
  usr_bruno: [],
}

export interface SeedCoupon {
  code: string
  percentOff: number
  description: string
  expiresAt: number
}

export const SEED_COUPONS: SeedCoupon[] = [
  { code: 'KURIO10', percentOff: 10, description: '10% de desconto no lançamento', expiresAt: Date.UTC(2030, 0, 1) },
  { code: 'GENESIS5', percentOff: 5, description: '5% para colecionadores gênesis', expiresAt: Date.UTC(2030, 0, 1) },
  { code: 'VERAO2025', percentOff: 15, description: 'Campanha de verão 2025', expiresAt: Date.UTC(2025, 2, 1) },
]

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}
