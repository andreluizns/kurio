import { toast } from 'sonner'

/** Ações fora do escopo da entrega: informam claramente, sem simular sucesso. */
export function comingSoon(feature: string) {
  toast.info(`${feature} ainda não está disponível nesta versão.`, { id: `soon-${feature}` })
}
