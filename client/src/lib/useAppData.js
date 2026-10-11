import { useEffect, useState, useCallback } from 'react'
import {
  getProfile,
  listSubjects,
  listAnnouncements,
  listDeliverables,
  listAlerts,
} from '../api/index.js'

const EMPTY = { profile: null, subjects: [], announcements: [], deliverables: [], alerts: [] }

export function useAppData() {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [data, setData] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [slow, setSlow] = useState(false)

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    const timer = setTimeout(() => setSlow(true), 3000)

    try {
      const [profile, subjects, announcements, deliverables, alerts] = await Promise.all([
        getProfile(),
        listSubjects(),
        listAnnouncements(),
        listDeliverables(),
        listAlerts(),
      ])
      setData({ profile, subjects, announcements, deliverables, alerts })
      setStatus('ready')
    } catch (caught) {
      setError(caught)
      setStatus('error')
    } finally {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { status, data, error, slow, reload: load }
}
