/**
 * Substituto mínimo de `tough-cookie` para o bundle do navegador (alias em vite.config.ts).
 * O MSW o usa para simular cookies de resposta; a API da Kurio autentica por token Bearer e
 * não depende de cookies. Remover o pacote real (e o `tldts`) reduz ~60 KB gzip da camada de mocks.
 * Limitação documentada em ARCHITECTURE.md: os mocks não persistem cookies `Set-Cookie`.
 */
type Index = Record<string, Record<string, Record<string, unknown>>>

export class Cookie {
  static fromJSON(): Cookie | null {
    return null
  }
  toJSON() {
    return {}
  }
}

export class MemoryCookieStore {
  idx: Index = {}
}

export class CookieJar {
  constructor(public readonly store?: MemoryCookieStore) {}
  getCookiesSync(): Cookie[] {
    return []
  }
  async setCookie(): Promise<void> {}
}
