import { isApiError } from '@/api/http'

export function errorMessage(error: unknown, fallback = 'Não foi possível carregar os dados.') {
  if (isApiError(error)) {
    if (error.code === 'NETWORK_ERROR') return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
    if (error.code === 'TIMEOUT') return 'O servidor demorou para responder. Tente novamente.'
    return error.message
  }
  return fallback
}
