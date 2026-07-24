import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [profil, setProfil] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) chargerProfil(session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) chargerProfil(session.user.id)
      else { setProfil(null); setLoading(false) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function chargerProfil(userId) {
    const { data } = await supabase.from('profils').select('*').eq('id', userId).single()
    setProfil(data)
    setLoading(false)
  }

  return { session, profil, loading }
}
