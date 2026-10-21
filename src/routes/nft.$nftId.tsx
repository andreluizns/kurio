import { createFileRoute } from '@tanstack/react-router'
import { nftDetailOptions, relatedOptions } from '@/features/catalog/queries'
import { NftDetailPage } from '@/features/nft/NftDetailPage'

export const Route = createFileRoute('/nft/$nftId')({
  validateSearch: (search: Record<string, unknown>): { edicao?: string } => ({
    edicao: typeof search.edicao === 'string' ? search.edicao : undefined,
  }),
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailOptions(params.nftId))
    void context.queryClient.prefetchQuery(relatedOptions(params.nftId))
  },
  component: NftRoute,
})

function NftRoute() {
  const { nftId } = Route.useParams()
  const { edicao } = Route.useSearch()
  return <NftDetailPage nftId={nftId} editionParam={edicao} />
}
