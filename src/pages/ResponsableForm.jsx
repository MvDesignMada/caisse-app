import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Send, CheckCircle } from 'lucide-react'
import MontantInput from '../components/MontantInput'
import CategorieSortiePicker from '../components/CategorieSortiePicker'
import CreancesSection from '../components/CreancesSection'

export default function ResponsableForm({ profil }) {
  const today = new Date().toISOString().split('T')[0]
  const [rapport, setRapport] = useState(null)
  const [sorties, setSorties] = useState([])
  const [espèces, setEspèces] = useState('')
  const [chèque, setChèque] = useState('')
  const [mobileMoney, setMobileMoney] = useState('')
  const [différés, setDifférés] = useState('')
  const [totalEncaissements, setTotalEncaissements] = useState(0)
  const [soldeVeille, setSoldeVeille] = useState('')
  const [observation, setObservation] = useState('')
  const [categorieSortie, setCategorieSortie] = useState(null)
  const [montantSortie, setMontantSortie] = useState('')
  const [estVersement, setEstVersement] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { chargerRapportDuJour() }, [])

  async function chargerRapportDuJour() {
    setLoading(true)
    let { data: existant } = await supabase
      .from('rapports')
      .select('*, sorties(*)')
      .eq('date', today)
      .eq('magasin_id', profil.magasin_id)
      .maybeSingle()

    if (!existant) {
      // Récupère le solde de la veille du dernier rapport connu
      const { data: dernier } = await supabase
        .from('rapports')
        .select('solde')
        .eq('magasin_id', profil.magasin_id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { data: nouveau, error } = await supabase
        .from('rapports')
        .insert({
          date: today,
          magasin_id: profil.magasin_id,
          responsable_id: profil.id,
          solde_veille: dernier?.solde || 0,
        })
        .select('*, sorties(*)')
        .single()

      if (!error) existant = nouveau
    }

    if (existant) {
      setRapport(existant)
      setEspèces(existant.espèces || '')
      setChèque(existant.chèque || '')
      setMobileMoney(existant.mobile_money || '')
      setDifférés(existant.différés || '')
      setTotalEncaissements(existant.total_encaissements || 0)
      setSoldeVeille(existant.solde_veille || 0)
      setObservation(existant.observation || '')
      setSorties(existant.sorties || [])
    }
    setLoading(false)
  }

  async function sauvegarderChamps(champs) {
    if (!rapport || rapport.statut === 'validé') return
    setSaving(true)
    await supabase.from('rapports').update(champs).eq('id', rapport.id)
    setSaving(false)
  }

  async function rafraîchirCréances() {
    const { data } = await supabase.from('rapports').select('différés, total_encaissements').eq('id', rapport.id).single()
    if (data) {
      setDifférés(data.différés || '')
      setTotalEncaissements(data.total_encaissements || 0)
    }
  }

  async function ajouterSortie() {
    if (!montantSortie) return
    let libellé, categorie_depense
    if (estVersement) {
      libellé = 'Versement banque'
      categorie_depense = null
    } else {
      if (!categorieSortie) return
      categorie_depense = categorieSortie
      libellé = categorieSortie
    }
    const { data, error } = await supabase
      .from('sorties')
      .insert({
        rapport_id: rapport.id,
        libellé,
        montant: parseFloat(montantSortie),
        catégorie: estVersement ? 'versement' : 'dépense',
        categorie_depense,
      })
      .select()
      .single()
    if (!error) {
      setSorties([...sorties, data])
      setCategorieSortie(null)
      setMontantSortie('')
      setEstVersement(false)
    } else {
      alert('Erreur lors de l\'ajout de la sortie : ' + error.message)
      console.error(error)
    }
  }

  async function supprimerSortie(id) {
    await supabase.from('sorties').delete().eq('id', id)
    setSorties(sorties.filter((s) => s.id !== id))
  }

  async function envoyerRapport() {
    if (!confirm('Envoyer le rapport ? Il ne sera plus modifiable après.')) return
    await supabase.from('rapports').update({
      espèces: parseFloat(espèces) || 0,
      observation,
      statut: 'validé',
    }).eq('id', rapport.id)
    chargerRapportDuJour()
  }

  if (loading) return <p className="text-center mt-10">Chargement...</p>

  const totalSorties = sorties.reduce((s, x) => s + Number(x.montant), 0)
  const totalVentes = (parseFloat(espèces) || 0) + (parseFloat(chèque) || 0) + (parseFloat(mobileMoney) || 0) + (parseFloat(différés) || 0)
  const résultat = totalVentes - totalSorties
  const solde = (parseFloat(soldeVeille) || 0) + (parseFloat(espèces) || 0) + (parseFloat(totalEncaissements) || 0) - totalSorties
  const verrouillé = rapport?.statut === 'validé'
  const dernierVersement = [...sorties].reverse().find((s) => s.catégorie === 'versement')

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Rapport du {new Date(today).toLocaleDateString('fr-FR')}</h1>
        {verrouillé && (
          <span className="flex items-center gap-1 text-primary-600 font-semibold">
            <CheckCircle size={18} /> Envoyé
          </span>
        )}
      </div>

      <section className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow space-y-4">
        <h2 className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-sm">Ventes</h2>
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400">Espèces (cash reçu aujourd'hui)</label>
          <MontantInput
            disabled={verrouillé}
            value={espèces}
            onChange={(v) => setEspèces(v)}
            onBlur={() => sauvegarderChamps({ espèces: parseFloat(espèces) || 0 })}
            className="input-big" placeholder="0"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400">Chèque</label>
          <MontantInput
            disabled={verrouillé}
            value={chèque}
            onChange={(v) => setChèque(v)}
            onBlur={() => sauvegarderChamps({ chèque: parseFloat(chèque) || 0 })}
            className="input-big" placeholder="0"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400">Mobile Money (Mvola, Orange Money...)</label>
          <MontantInput
            disabled={verrouillé}
            value={mobileMoney}
            onChange={(v) => setMobileMoney(v)}
            onBlur={() => sauvegarderChamps({ mobile_money: parseFloat(mobileMoney) || 0 })}
            className="input-big" placeholder="0"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400">Ventes différées (crédit — calculé automatiquement ci-dessous)</label>
          <div className="input-big bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {(parseFloat(différés) || 0).toLocaleString()} Ar
          </div>
        </div>
        <p className="text-right font-semibold">Total ventes : {totalVentes.toLocaleString()} Ar</p>
      </section>

      <section className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
        <h2 className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-sm mb-3">Clients & créances</h2>
        <CreancesSection
          magasinId={profil.magasin_id}
          rapportId={rapport?.id}
          disabled={verrouillé}
          onChanged={rafraîchirCréances}
        />
      </section>

      <section className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow space-y-3">
        <h2 className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-sm">Sorties de caisse</h2>
        {sorties.map((s) => (
          <div key={s.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-xl">
            <span>
              {s.libellé}
              {s.catégorie === 'versement' && (
                <span className="ml-2 text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">Versement</span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{Number(s.montant).toLocaleString()} Ar</span>
              {!verrouillé && (
                <button onClick={() => supprimerSortie(s.id)} className="text-red-500">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
        {!verrouillé && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox" checked={estVersement}
                onChange={(e) => { setEstVersement(e.target.checked); setCategorieSortie(null) }}
                className="w-5 h-5"
              />
              Ceci est un versement (dépôt en banque, sort le cash de la caisse)
            </label>

            {!estVersement && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Catégorie de la dépense</p>
                <CategorieSortiePicker valeur={categorieSortie} onChange={setCategorieSortie} />
              </div>
            )}

            <div className="flex gap-2">
              <MontantInput
                placeholder="Montant" value={montantSortie}
                onChange={(v) => setMontantSortie(v)}
                className="input-big flex-1"
              />
              <button onClick={ajouterSortie} className="btn-big bg-primary-600 text-white px-4">
                <Plus size={22} />
              </button>
            </div>
          </div>
        )}
        <p className="text-right font-semibold">Total sorties : {totalSorties.toLocaleString()} Ar</p>
        {dernierVersement && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
            Dernier versement aujourd'hui : {Number(dernierVersement.montant).toLocaleString()} Ar
          </p>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow space-y-2">
        <h2 className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-sm">Résultat & solde</h2>
        <div className="flex justify-between"><span>Cash restant en caisse (veille)</span><span>{Number(soldeVeille).toLocaleString()} Ar</span></div>
        {totalEncaissements > 0 && (
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>+ Encaissements clients (dettes anciennes)</span><span>{Number(totalEncaissements).toLocaleString()} Ar</span>
          </div>
        )}
        <div className="flex justify-between font-semibold"><span>Résultat (ventes − sorties)</span><span>{résultat.toLocaleString()} Ar</span></div>
        <div className="flex justify-between font-bold text-primary-700 dark:text-primary-400 text-lg"><span>Cash physique en caisse</span><span>{solde.toLocaleString()} Ar</span></div>
      </section>

      <section className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
        <label className="text-sm text-gray-600 dark:text-gray-400">Observations</label>
        <textarea
          disabled={verrouillé} value={observation}
          onChange={(e) => setObservation(e.target.value)}
          onBlur={() => sauvegarderChamps({ observation })}
          className="input-big" rows={3}
        />
      </section>

      {!verrouillé && (
        <button onClick={envoyerRapport} className="btn-big bg-primary-600 text-white w-full flex items-center justify-center gap-2 fixed bottom-4 left-4 right-4 max-w-5xl mx-auto">
          <Send size={20} /> Envoyer le rapport
        </button>
      )}
    </div>
  )
}
