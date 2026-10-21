/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "false" desativa a camada de mocks (MSW). Padrão: ativada. */
  readonly VITE_ENABLE_MOCKS?: string
  /** Origem do servidor Socket.IO. Padrão: a própria origem da aplicação. */
  readonly VITE_SOCKET_URL?: string
  /** "false" oculta o painel de controle dos mocks. */
  readonly VITE_MOCK_PANEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
