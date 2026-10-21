/**
 * Promessa resolvida quando a camada de mocks está interceptando a rede (ou imediatamente,
 * sem mocks). A aplicação renderiza em paralelo; requisições e o Socket.IO aguardam esta promessa.
 */
let resolveReady: () => void = () => {}
export const mocksReady = new Promise<void>((resolve) => {
  resolveReady = resolve
})

export function markMocksReady() {
  resolveReady()
}
