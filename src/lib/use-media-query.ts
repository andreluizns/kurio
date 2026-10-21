import { useSyncExternalStore } from 'react'

export const DESKTOP_QUERY = '(min-width: 768px)'

/** Assina uma media query; usado quando os layouts mobile e desktop divergem na estrutura. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY)
