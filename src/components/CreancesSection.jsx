import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, ChevronDown } from 'lucide-react'
import MontantInput from './MontantInput'

export default function CreancesSection({ magasinId, rapportId, disabled, onChanged }) {
  const [clients, setClients] = useState([])
  const [ventesCréditDuJour, setVentesCréditDuJour] = useState([])
  const [clientsAvecDette, setClientsAvecDette] = useState([]) // [{client, créances: [...]}]

  const [nomNouveauClient, setNomNouveauClient] = useState('')
  const [montantVente, setMontantVente] = useState('')

  const [clientSélectionné, setClientSélectionné] = useState('')
  const [montantsEncaissement, setMontantsEncaissement] = useState({}) // creance_id -> montant tapé

  const [nomDetteExistante, setNomDetteExistante] = useState('')
  const [montantDetteExistante, setMontantDetteExistante] = useState('')
  const [dateDetteExistante, setDateDetteExistante] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => { chargerDonnées() }, [rapportId])

  async function chargerDonnées() {
    const { data: clientsData } = await supabase.from('clients').select('*').eq('magasin_id', magasinId)
    setClients(clientsData || [])

    if (rapportId) {
      const { data: ventes } = await supabase
        .from('creances')
        .select('*, clients(nom)')
        .eq('rapport_id', rapportId)
        .eq('origine', 'vente')
      setVentesCréditDuJour(ventes || [])
    }

    const { data: créancesOuvertes } = await supabase
      .from('creances')
      .select('*, clients(nom)')
      .eq('magasin_id', magasinId)
      .eq('statut', 'ouverte')
      .gt('montant_restant', 0)

    const parClient = {}
    ;(créancesOuvertes || []).forEach((c) => {
      const nom = c.clients?.nom || 'Client inconnu'
      if (!parClient[nom]) parClient[nom] = []
      parClient[nom].push(c)
    })
    setClientsAvecDette(Object.entries(parClient).map(([nom, créances]) => ({ nom, créances })))
  }

  async function trouverOuCréerClient(nom) {
    const existant = clients.find((c) => c.nom.toLowerCase() === nom.trim().toLowerCase())
    if (existant) return existant.id
    const { data, error } = await supabase.from('clients').insert({ magasin_id: magasinId, nom: nom.trim() }).select().single()
    if (error) return null
    setClients([...clients, data])
    return data.id
  }

  async function ajouterVenteCrédit() {
    if (!nomNouveauClient.trim() || !montantVente) return
    const clientId = await trouverOuCréerClient(nomNouveauClient)
    if (!clientId) return
    const montant = parseFloat(montantVente)
    await supabase.from('creances').insert({
      client_id: clientId, magasin_id: magasinId, rapport_id: rapportId,
      montant_initial: montant, montant_restant: montant, origine: 'vente',
    })
    setNomNouveauClient('')
    setMontantVente('')
    await chargerDonnées()
    onChanged?.()
  }

  async function supprimerVenteCrédit(id) {
    await supabase.from('creances').delete().eq('id', id)
    await chargerDonnées()
    onChanged?.()
  }

  async function encaisser(creanceId) {
    const montant = parseFloat(montantsEncaissement[creanceId])
    if (!montant || montant <= 0) return
    await supabase.from('encaissements').insert({ creance_id: creanceId, rapport_id: rapportId, montant })
    setMontantsEncaissement({ ...montantsEncaissement, [creanceId]: '' })
    await chargerDonnées()
    onChanged?.()
  }

  async function ajouterDetteExistante() {
    if (!nomDetteExistante.trim() || !montantDetteExistante) return
    const clientId = await trouverOuCréerClient(nomDetteExistante)
    if (!clientId) return
    const montant = parseFloat(montantDetteExistante)
    await supabase.from('creances').insert({
      client_id: clientId, magasin_id: magasinId, rapport_id: null,
      date_creation: dateDetteExistante,
      montant_initial: montant, montant_restant: montant, origine: 'solde_initial',
    })
    setNomDetteExistante('')
    setMontantDetteExistante('')
    await chargerDonnées()
  }

  const clientChoisi = clientsAvecDette.find((c) => c.nom === clientSélectionné)

  return (
    <div className="space-y-4">
      {/* Nouvelles ventes à crédit du jour */}
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Nouvelle vente à crédit</p>
        {ventesCréditDuJour.map((v) => (
          <div key={v.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-xl mb-2">
            <span>{v.clients?.nom}</span>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{Number(v.montant_initial).toLocaleString()} Ar</span>
              {!disabled && (
                <button onClick={() => supprimerVenteCrédit(v.id)} className="text-red-500">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
        {!disabled && (
          <div className="flex gap-2">
            <input
              list="liste-clients" placeholder="Nom du client" value={nomNouveauClient}
              onChange={(e) => setNomNouveauClient(e.target.value)}
              className="input-big flex-1"
            />
            <datalist id="liste-clients">
              {clients.map((c) => <option key={c.id} value={c.nom} />)}
            </datalist>
            <MontantInput placeholder="Montant" value={montantVente} onChange={setMontantVente} className="input-big w-32" />
            <button onClick={ajouterVenteCrédit} className="btn-big bg-primary-600 text-white px-4">
              <Plus size={22} />
            </button>
          </div>
        )}
      </div>

      {/* Encaisser un client */}
      {clientsAvecDette.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Encaisser un client (remboursement d'une ancienne créance)</p>
          <select
            value={clientSélectionné}
            onChange={(e) => setClientSélectionné(e.target.value)}
            className="input-big mb-2"
          >
            <option value="">-- Choisir un client --</option>
            {clientsAvecDette.map((c) => (
              <option key={c.nom} value={c.nom}>
                {c.nom} (doit {c.créances.reduce((s, x) => s + Number(x.montant_restant), 0).toLocaleString()} Ar)
              </option>
            ))}
          </select>
          {clientChoisi && !disabled && clientChoisi.créances.map((c) => (
            <div key={c.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-xl mb-2">
              <div>
                <p className="text-sm">Depuis le {c.date_creation}</p>
                <p className="font-semibold">Doit encore {Number(c.montant_restant).toLocaleString()} Ar</p>
              </div>
              <div className="flex gap-2">
                <MontantInput
                  placeholder="Reçu" value={montantsEncaissement[c.id] || ''}
                  onChange={(v) => setMontantsEncaissement({ ...montantsEncaissement, [c.id]: v })}
                  className="input-big w-28"
                />
                <button onClick={() => encaisser(c.id)} className="btn-big bg-primary-600 text-white px-3 text-sm">OK</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dette déjà existante à saisir pour mise à jour (n'affecte pas le chiffre d'affaires du jour) */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 dark:text-gray-400 flex items-center gap-1">
          <ChevronDown size={16} /> Saisir une dette déjà existante (ancien client)
        </summary>
        <div className="mt-2 space-y-2">
          <input
            list="liste-clients" placeholder="Nom du client" value={nomDetteExistante}
            onChange={(e) => setNomDetteExistante(e.target.value)}
            className="input-big"
          />
          <div className="flex gap-2">
            <MontantInput placeholder="Montant dû" value={montantDetteExistante} onChange={setMontantDetteExistante} className="input-big flex-1" />
            <input
              type="date" value={dateDetteExistante}
              onChange={(e) => setDateDetteExistante(e.target.value)}
              className="input-big w-40"
            />
          </div>
          <button onClick={ajouterDetteExistante} className="btn-big bg-gray-600 text-white w-full">
            Enregistrer cette dette existante
          </button>
        </div>
      </details>
    </div>
  )
}
