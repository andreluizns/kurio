import type { CatalogQuery } from './contracts'

/**
 * Chaves do TanStack Query. Dados privados carregam o id do usuário (ou "guest") para
 * isolar o cache entre sessões; o catálogo é chaveado pelos parâmetros da consulta.
 */
export const queryKeys = {
  catalog: {
    all: ['catalog'] as const,
    list: (query: CatalogQuery) => ['catalog', 'list', query] as const,
    highlights: ['catalog', 'highlights'] as const,
    recommendations: ['catalog', 'recommendations'] as const,
    detail: (id: string) => ['catalog', 'detail', id] as const,
    related: (id: string) => ['catalog', 'related', id] as const,
  },
  session: ['session'] as const,
  /** Raiz de todos os dados privados de um usuário. */
  private: (userId: string) => ['user', userId] as const,
  cart: (owner: string) => ['user', owner, 'cart'] as const,
  favorites: (userId: string) => ['user', userId, 'favorites'] as const,
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  wallets: (userId: string) => ['user', userId, 'wallets'] as const,
  order: (userId: string, orderId: string) => ['user', userId, 'order', orderId] as const,
  orders: (userId: string, status?: string) => ['user', userId, 'orders', status ?? 'all'] as const,
}

export const GUEST = 'guest'
