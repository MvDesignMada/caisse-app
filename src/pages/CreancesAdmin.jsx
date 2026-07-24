import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle } from 'lucide-react'

const DÉLAI_MAX_JOURS = 30 // le maximum de crédit accordé à un client dans ces magasins

export default function CreancesAdmin() {
  const [créances, setCréances] = useState([])
  const [magasins, setMagasins] = useState([])
  const [filtreMagasin, setFiltreMagasin] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { chargerMagasins(); chargerCréances() }, [filtreMagasin])

  async function chargerMagasins() {
    const { data } = await supabase.from('magasins').select('*')
    setMagasins(data || [])
  }

  async function chargerCréances() {
    setLoading(true)
    let query = supabase
      .from('creances')
      .select('*, clients(nom, telephone), magasins(nom)')
      .eq('statut', 'ouverte')
      .gt('montant_restant', 0)
      .order('date_creation', { ascending: true })
    if (filtreMagasin) query = query.eq('magasin_id', filtreMagasin)
    const { data } = await query
    setCréances(data || [])
    setLoading(false)
  }

  function joursÉcoulés(date) {
    return Math.floor((new Date() - new Date(date)) / 86400000)
  }

  const totalDû = créances.reduce((s, c) => s + Number(c.montant_restant), 0)
  const enRetard = créances.filter((c) => joursÉcoulés(c.date_creation) > DÉLAI_MAX_JOURS)

  // Regroupement par client pour la vue de synthèse
  const parClient = {}
  créances.forEach((c) => {
    const clé = `${c.clients?.nom}-${c.magasins?.nom}`
    if (!parClient[clé]) parClient[clé] = { nom: c.clients?.nom, magasin: c.magasins?.nom, téléphone: c.clients?.telephone, total: 0, créances: [] }
    parClient[clé].total += Number(c.montant_restant)
    parClient[clé].créances.push(c)
  })
  const clients = Object.values(parClient).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Créances en cours</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total dû (tous clients)</p>
          <p className="text-xl font-bold text-primary-700 dark:text-primary-400">{totalDû.toLocaleString()} Ar</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
          <p className="text-xs text-gray-500 dark:text-gray-400">Créances en retard (+{DÉLAI_MAX_JOURS}j)</p>
          <p className={`text-xl font-bold ${enRetard.length > 0 ? 'text-red-500' : 'text-primary-700 dark:text-primary-400'}`}>
            {enRetard.length}
          </p>
        </div>
      </div>

      <select value={filtreMagasin} onChange={(e) => setFiltreMagasin(e.target.value)} className="input-big">
        <option value="">Tous les magasins</option>
        {magasins.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
      </select>

      {loading ? <p>Chargement...</p> : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow divide-y dark:divide-gray-700">
          {clients.length === 0 && <p className="p-4 text-gray-500 dark:text-gray-400">Aucune créance ouverte.</p>}
          {clients.map((c) => (
            <div key={c.nom + c.magasin} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{c.nom}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{c.magasin}{c.téléphone ? ` · ${c.téléphone}` : ''}</p>
                </div>
                <p className="font-bold text-lg">{c.total.toLocaleString()} Ar</p>
              </div>
              <div className="mt-2 space-y-1">
                {c.créances.map((créance) => {
                  const jours = joursÉcoulés(créance.date_creation)
                  const enRetardIci = jours > DÉLAI_MAX_JOURS
                  return (
                    <div key={créance.id} className={`flex justify-between text-sm ${enRetardIci ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      <span className="flex items-center gap-1">
                        {enRetardIci && <AlertTriangle size={14} />}
                        Depuis le {créance.date_creation} ({jours} j) {créance.origine === 'solde_initial' ? '· dette existante' : ''}
                      </span>
                      <span>{Number(créance.montant_restant).toLocaleString()} Ar</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
