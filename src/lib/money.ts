import Big from 'big.js'
import type { Eth } from '@/api/contracts'

// Aritmética decimal exata para valores em ETH (strings decimais no transporte).
Big.DP = 18
Big.RM = Big.roundHalfUp

export const eth = (value: Eth | number | Big) => new Big(value)

export function add(...values: Eth[]): Eth {
  return values.reduce((acc, v) => acc.plus(v), new Big(0)).toString()
}

export function sub(a: Eth, b: Eth): Eth {
  return new Big(a).minus(b).toString()
}

export function mul(a: Eth, quantity: number | Eth): Eth {
  return new Big(a).times(quantity).toString()
}

/** Percentual de `a`, arredondado em 6 casas. */
export function percentOf(a: Eth, percent: number): Eth {
  return new Big(a).times(percent).div(100).round(6, Big.roundHalfUp).toString()
}

export function compare(a: Eth, b: Eth): -1 | 0 | 1 {
  return new Big(a).cmp(b) as -1 | 0 | 1
}

export function isZero(a: Eth) {
  return new Big(a).eq(0)
}

/** Normaliza para string decimal canônica (sem expoente). */
export function normalize(a: Eth | number): Eth {
  return new Big(a).toFixed()
}

/**
 * Formata para exibição: no mínimo 2 casas decimais e sem perder precisão significativa.
 * "1.19" → "1.19", "26.846" → "26.846", "2" → "2.00".
 */
export function formatEth(value: Eth, { suffix = true }: { suffix?: boolean } = {}) {
  const b = new Big(value)
  const [, decimals = ''] = b.toFixed().split('.')
  const places = Math.max(2, decimals.replace(/0+$/, '').length)
  const text = b.toFixed(Math.min(places, 6))
  return suffix ? `${text} ETH` : text
}

/** Exibição do desconto no padrão do layout: "(-) 00.00" quando zerado. */
export function formatDiscount(value: Eth) {
  return isZero(value) ? '(-) 00.00' : `(-) ${formatEth(value)}`
}

/** Formata com vírgula decimal (padrão pt-BR) para o filtro de preço. */
export function formatEthBr(value: Eth) {
  return new Big(value).toFixed(2).replace('.', ',')
}

/** Converte entrada do usuário ("0,5" ou "0.5") para string decimal; null se inválida. */
export function parseEthInput(input: string): Eth | null {
  const cleaned = input.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  return new Big(cleaned).toFixed()
}
