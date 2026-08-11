import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import MontantInput from '../components/MontantInput'

const DÉLAI_MAX_JOURS = 30 // le maximum de crédit accordé à un client dans ces magasins

export default function CreancesAdmin() {
  const [créances, setCréances] = useState([])
  const [magasins, setMagasins] = useState([])
  const [filtreMagasin, setFiltreMagasin] = useState('')
  const [afficherSoldées, setAfficherSoldées] = useState(false)
  const [loading, setLoading] = useState(true)
  const [créanceSélectionnée, setCréanceSélectionnée] = useState(null)
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false)

  useEffect(() => { chargerMagasins(); chargerCréances() }, [filtreMagasin, afficherSoldées])

  async function chargerMagasins() {
    const { data } = await supabase.from('magasins').select('*')
    setMagasins(data || [])
  }

  async function chargerCréances() {
    setLoading(true)
    let query = supabase
      .from('creances')
      .select('*, clients(nom, telephone), magasins(nom)')
      .order('date_creation', { ascending: true })
    if (!afficherSoldées) query = query.eq('statut', 'ouverte').gt('montant_restant', 0)
    if (filtreMagasin) query = query.eq('magasin_id', filtreMagasin)
    const { data } = await query
    setCréances(data || [])
    setLoading(false)
  }

  function joursÉcoulés(date) {
    return Math.floor((new Date() - new Date(date)) / 86400000)
  }

  const totalDû = créances.filter(c => c.statut === 'ouverte').reduce((s, c) => s + Number(c.montant_restant), 0)
  const enRetard = créances.filter((c) => c.statut === 'ouverte' && joursÉcoulés(c.date_creation) > DÉLAI_MAX_JOURS)

  // Regroupement par client pour la vue de synthèse
  const parClient = {}
  créances.forEach((c) => {
    const clé = `${c.clients?.nom}-${c.magasins?.nom}`
    if (!parClient[clé]) parClient[clé] = { nom: c.clients?.nom, magasin: c.magasins?.nom, téléphone: c.clients?.telephone, total: 0, créances: [] }
    if (c.statut === 'ouverte') parClient[clé].total += Number(c.montant_restant)
    parClient[clé].créances.push(c)
  })
  const clients = Object.values(parClient).sort((a, b) => b.total - a.total)

  function ouvrirModaleEdition(créance) {
    setCréanceSélectionnée({ ...créance })
  }

  async function sauvegarderCréance() {
    setEnregistrementEnCours(true)
    const c = créanceSélectionnée
    try {
      const { error } = await supabase.from('creances').update({
        date_creation: c.date_creation,
        montant_initial: c.montant_initial,
        montant_restant: c.montant_restant,
        statut: c.statut,
        origine: c.origine,
        observation: c.observation,
      }).eq('id', c.id)
      if (error) throw error
      setCréanceSélectionnée(null)
      chargerCréances()
    } catch (err) {
      alert('Erreur lors de la sauvegarde : ' + err.message)
    } finally {
      setEnregistrementEnCours(false)
    }
  }

  async function supprimerCréance(id) {
    if (!confirm('Supprimer définitivement cette créance ? Cette action est irréversible.')) return
    const { error } = await supabase.from('creances').delete().eq('id', id)
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
      return
    }
    chargerCréances()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Créances</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total dû (créances ouvertes)</p>
          <p className="text-xl font-bold text-primary-700 dark:text-primary-400">{totalDû.toLocaleString()} Ar</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
          <p className="text-xs text-gray-500 dark:text-gray-400">Créances en retard (+{DÉLAI_MAX_JOURS}j)</p>
          <p className={`text-xl font-bold ${enRetard.length > 0 ? 'text-red-500' : 'text-primary-700 dark:text-primary-400'}`}>
            {enRetard.length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={filtreMagasin} onChange={(e) => setFiltreMagasin(e.target.value)} className="input-big w-auto">
          <option value="">Tous les magasins</option>
          {magasins.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input type="checkbox" checked={afficherSoldées} onChange={(e) => setAfficherSoldées(e.target.checked)} className="w-5 h-5" />
          Inclure les créances soldées
        </label>
      </div>

      {loading ? <p>Chargement...</p> : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow divide-y dark:divide-gray-700">
          {clients.length === 0 && <p className="p-4 text-gray-500 dark:text-gray-400">Aucune créance.</p>}
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
                  const enRetardIci = créance.statut === 'ouverte' && jours > DÉLAI_MAX_JOURS
                  const soldée = créance.statut === 'soldée'
                  return (
                    <div key={créance.id} className={`flex justify-between items-center text-sm ${enRetardIci ? 'text-red-500' : soldée ? 'text-gray-400 line-through' : 'text-gray-500 dark:text-gray-400'}`}>
                      <span className="flex items-center gap-1">
                        {enRetardIci && <AlertTriangle size={14} />}
                        Depuis le {créance.date_creation} ({jours} j) {créance.origine === 'solde_initial' ? '· dette existante' : ''}
                        {soldée && ' · soldée'}
                      </span>
                      <span className="flex items-center gap-2">
                        {Number(créance.montant_restant).toLocaleString()} Ar
                        <button onClick={() => ouvrirModaleEdition(créance)} className="text-gray-400 hover:text-primary-600">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => supprimerCréance(créance.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {créanceSélectionnée && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-md space-y-3 my-8">
            <h2 className="font-bold text-lg">Modifier la créance</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {créanceSélectionnée.clients?.nom} · {créanceSélectionnée.magasins?.nom}
            </p>

            <label className="text-sm">Date de création</label>
            <input
              type="date"
              className="input-big w-full"
              value={créanceSélectionnée.date_creation}
              onChange={(e) => setCréanceSélectionnée({ ...créanceSélectionnée, date_creation: e.target.value })}
            />

            <label className="text-sm">Montant initial</label>
            <MontantInput className="input-big" value={créanceSélectionnée.montant_initial}
              onChange={(v) => setCréanceSélectionnée({ ...créanceSélectionnée, montant_initial: v })} />

            <label className="text-sm">Montant restant dû</label>
            <MontantInput className="input-big" value={créanceSélectionnée.montant_restant}
              onChange={(v) => setCréanceSélectionnée({ ...créanceSélectionnée, montant_restant: v })} />

            <label className="text-sm">Statut</label>
            <select
              className="input-big w-full"
              value={créanceSélectionnée.statut}
              onChange={(e) => setCréanceSélectionnée({ ...créanceSélectionnée, statut: e.target.value })}
            >
              <option value="ouverte">Ouverte</option>
              <option value="soldée">Soldée</option>
            </select>

            <label className="text-sm">Origine</label>
            <select
              className="input-big w-full"
              value={créanceSélectionnée.origine}
              onChange={(e) => setCréanceSélectionnée({ ...créanceSélectionnée, origine: e.target.value })}
            >
              <option value="vente">Vente</option>
              <option value="solde_initial">Dette existante (solde initial)</option>
            </select>

            <label className="text-sm">Observation</label>
            <textarea className="input-big w-full" value={créanceSélectionnée.observation || ''}
              onChange={(e) => setCréanceSélectionnée({ ...créanceSélectionnée, observation: e.target.value })} />

            <div className="flex gap-2 pt-2">
              <button onClick={sauvegarderCréance} disabled={enregistrementEnCours} className="btn-big bg-primary-600 text-white flex-1 disabled:opacity-50">
                {enregistrementEnCours ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setCréanceSélectionnée(null)} className="btn-big bg-gray-300 dark:bg-gray-700 flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
