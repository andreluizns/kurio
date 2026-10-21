import { http, HttpResponse } from 'msw'
import type { CatalogPage, Highlights, NftDetail, NftSummary } from '@/api/contracts'
import { db } from '../db'
import { parseCatalogQuery, queryCatalog, toSummary } from '../domain'
import { API, apiError, networkConditions } from '../http'

const RECOMMENDED = [
  'nft-cosmic-bloom-118',
  'nft-violet-nomad-314',
  'nft-ivory-baron-088',
  'nft-golden-beat-207',
  'nft-golden-signal-160',
]

export const catalogHandlers = [
  http.get(`${API}/nfts`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'catalog' })
    if (blocked) return blocked
    const query = parseCatalogQuery(new URL(request.url))
    return HttpResponse.json<CatalogPage>(queryCatalog(query))
  }),

  http.get(`${API}/highlights`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'catalog' })
    if (blocked) return blocked
    const nfts = db().nfts
    const featured = nfts['nft-sage-nomad-009']
    return HttpResponse.json<Highlights>({
      slides: [
        {
          id: 'slide-emerald',
          eyebrow: 'Bem-vindo à Kurio',
          title: 'SEJA DONO DO FUTURO\nDA ARTE DIGITAL',
          description:
            'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
          nftId: 'nft-emerald-ape-042',
          artwork: 'emerald',
        },
        {
          id: 'slide-baron',
          eyebrow: 'Coleção em destaque',
          title: 'EDIÇÕES RARAS\nDE CRIADORES',
          description:
            'Obras verificadas na rede, com procedência registrada e direitos autorais para quem cria. Escolha a edição ideal para a sua coleção.',
          nftId: 'nft-ivory-baron-088',
          artwork: 'baron',
        },
        {
          id: 'slide-golden',
          eyebrow: 'Lançamento musical',
          title: 'O SOM DA\nCULTURA DIGITAL',
          description:
            'Golden Frequencies reúne colecionáveis sonoros de artistas independentes, com acesso antecipado a lançamentos e eventos.',
          nftId: 'nft-golden-beat-207',
          artwork: 'golden',
        },
      ],
      featured: toSummary(featured),
    })
  }),

  http.get(`${API}/nfts/:id`, async ({ request, params }) => {
    const blocked = await networkConditions(request, { scope: 'detail' })
    if (blocked) return blocked
    const nft = db().nfts[String(params.id)]
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json<NftDetail>(nft)
  }),

  http.get(`${API}/nfts/:id/related`, async ({ request, params }) => {
    const blocked = await networkConditions(request, { scope: 'detail' })
    if (blocked) return blocked
    const nfts = db().nfts
    const nft = nfts[String(params.id)]
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    const related = RECOMMENDED.filter((id) => id !== nft.id)
      .map((id) => nfts[id])
      .concat(Object.values(nfts).filter((n) => n.collection === nft.collection && n.id !== nft.id && !RECOMMENDED.includes(n.id)))
      .slice(0, 9)
    return HttpResponse.json<NftSummary[]>(related.map(toSummary))
  }),

  http.get(`${API}/recommendations`, async ({ request }) => {
    const blocked = await networkConditions(request, { scope: 'catalog' })
    if (blocked) return blocked
    const nfts = db().nfts
    const extra = db().nftOrder.slice(9, 13).map((id) => nfts[id])
    return HttpResponse.json<NftSummary[]>([...RECOMMENDED.map((id) => nfts[id]), ...extra].map(toSummary))
  }),
]
