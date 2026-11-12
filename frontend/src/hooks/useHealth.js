import { useCallback, useEffect, useState } from 'react'
import { fetchHealth, normalizeApiError } from '../services/api'

export function useHealth() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHealth()
      setHealth(data)
    } catch (err) {
      setError(normalizeApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { health, loading, error, refresh }
}
