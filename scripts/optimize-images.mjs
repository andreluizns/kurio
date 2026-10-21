// Gera variantes WebP das artes exportadas do Figma (design/images) em public/nfts.
// Uso: node scripts/optimize-images.mjs
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const ARTWORKS = {
  emerald: '8459204731e6eba9d474cbc8ebc37071360d3ba5',
  nomad: '2986a7cb16d09de8970824d2dd58bf0bb021702c',
  baron: '9df2ff42dd27ba657621c304557d1a855a4be6a5',
  golden: '87580f2def9af0ce13f4b6f6ce17bb2449bcfc16',
}
const WIDTHS = [160, 320, 640, 960]

await mkdir('public/nfts', { recursive: true })
for (const [key, ref] of Object.entries(ARTWORKS)) {
  for (const width of WIDTHS) {
    await sharp(`design/images/${ref}.png`)
      .resize({ width })
      .webp({ quality: 78 })
      .toFile(`public/nfts/${key}-${width}.webp`)
  }
  console.log('ok', key)
}
