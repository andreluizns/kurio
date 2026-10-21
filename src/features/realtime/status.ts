import { useSyncExternalStore } from 'react'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'

let status: RealtimeStatus = 'idle'
const listeners = new Set<() => void>()

export function setRealtimeStatus(next: RealtimeStatus) {
  if (status === next) return
  status = next
  for (const l of listeners) l()
}

export function useRealtimeStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
    () => status,
  )
}
