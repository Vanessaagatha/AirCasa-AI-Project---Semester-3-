import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

export interface AsyncState<T> {
  data: T | null
  error: Error | null
  loading: boolean
  /** time the data was last successfully loaded */
  loadedAt: string | null
  reload: () => void
}

/** Run an async loader whenever deps change; ignores stale responses. */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList, enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [loadedAt, setLoadedAt] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const callId = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const id = ++callId.current
    setLoading(true)
    setError(null)
    loader()
      .then((result) => {
        if (id !== callId.current) return
        setData(result)
        setLoadedAt(new Date().toISOString())
      })
      .catch((e: unknown) => {
        if (id !== callId.current) return
        setError(e instanceof Error ? e : new Error(String(e)))
        setData(null)
      })
      .finally(() => {
        if (id === callId.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, error, loading, loadedAt, reload }
}
