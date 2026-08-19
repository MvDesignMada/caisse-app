import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { exporterExcel, exporterCSV, exporterPDF, apercuRapportUniquePDF } from '../lib/export'
import { Eye, Pencil, Trash2, Download, FileSpreadsheet, FileText, Plus, ExternalLink } from 'lucide-react'
import MontantInput from '../components/MontantInput'

export default function Historique() {
  const [rapports, setRapports] = useState([])
  const [magasins, setMagasins] = useState([])
  const [profils, setProfils] = useState([])
  const [filtreMagasin, setFiltreMagasin] = useState('')
  const [filtreDate, setFiltreDate] = useState('')
  const [recherche, setRecherche] = useState('')
  const [rapportSelectionné, setRapportSelectionné] = useState(null)
  const [lignesSorties, setLignesSorties] = useState([])
  const [sortiesSupprimées, setSortiesSupprimées] = useState([])
  const [loading, setLoading] = useState(true)
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false)
  const [versementsParMagasin, setVersementsParMagasin] = useState({})

  const SEUIL_JOURS_ALERTE = 3

  useEffect(() => { chargerMagasins(); chargerProfils(); chargerRapports(); chargerVersements() }, [filtreMagasin, filtreDate])

  async function chargerMagasins() {
    const { data } = await supabase.from('magasins').select('*')
    setMagasins(data || [])
  }

  async function chargerProfils() {
    const { data } = await supabase.from('profils').select('id, nom, magasin_id').eq('role', 'responsable')
    setProfils(data || [])
  }

  async function chargerVersements() {
    const { data } = await supabase.from('dernier_versement').select('*')
    const parMagasin = {}
    for (const v of data || []) parMagasin[v.magasin_id] = v.date_dernier_versement
    setVersementsParMagasin(parMagasin)
  }

  // Un rapport est "en attente de versement" si sa date est postérieure au dernier
  // versement du magasin (ou si aucun versement n'a jamais été fait), ET que le
  // nombre de jours écoulés depuis ce dernier versement dépasse le seuil d'alerte.
  function rapportEnAttenteDeVersement(r) {
    const dernierVersement = versementsParMagasin[r.magasin_id]
    if (dernierVersement && r.date <= dernierVersement) return false
    const référence = dernierVersement || r.date
    const jours = Math.floor((new Date() - new Date(référence)) / 86400000)
    return jours >= SEUIL_JOURS_ALERTE
  }

  async function chargerRapports() {
    setLoading(true)
    let query = supabase.from('rapports').select('*, magasins(nom), profils(nom), sorties(*)').order('date', { ascending: false })
    if (filtreMagasin) query = query.eq('magasin_id', filtreMagasin)
    if (filtreDate) query = query.eq('date', filtreDate)
    const { data } = await query
    setRapports(data || [])
    setLoading(false)
  }

  const rapportsFiltrés = rapports.filter((r) => {
    if (!recherche) return true
    const s = recherche.toLowerCase()
    return (
      r.profils?.nom?.toLowerCase().includes(s) ||
      r.magasins?.nom?.toLowerCase().includes(s) ||
      String(r.espèces).includes(s) ||
      String(r.différés).includes(s)
    )
  })

  async function supprimerRapport(id) {
    if (!confirm('Supprimer définitivement ce rapport ?')) return
    await supabase.from('rapports').delete().eq('id', id)
    chargerRapports()
  }

  function ouvrirModaleEdition(r) {
    setRapportSelectionné({ ...r })
    setLignesSorties((r.sorties || []).map(s => ({ ...s })))
    setSortiesSupprimées([])
  }

  function ajouterLigneSortie() {
    setLignesSorties([...lignesSorties, {
      id: null, libellé: '', montant: '', catégorie: 'dépense', categorie_depense: '',
    }])
  }

  function modifierLigneSortie(index, champ, valeur) {
    const copie = [...lignesSorties]
    copie[index] = { ...copie[index], [champ]: valeur }
    setLignesSorties(copie)
  }

  function supprimerLigneSortie(index) {
    const ligne = lignesSorties[index]
    if (ligne.id) setSortiesSupprimées([...sortiesSupprimées, ligne.id])
    setLignesSorties(lignesSorties.filter((_, i) => i !== index))
  }

  const totalSortiesCalculé = lignesSorties.reduce((s, l) => s + (Number(l.montant) || 0), 0)

  async function sauvegarderModification() {
    setEnregistrementEnCours(true)
    const r = rapportSelectionné
    try {
      // 1. Mise à jour du rapport principal
      const { error: erreurRapport } = await supabase.from('rapports').update({
        date: r.date,
        magasin_id: r.magasin_id,
        responsable_id: r.responsable_id,
                espèces: Number(r.espèces) || 0,
        chèque: Number(r.chèque) || 0,
        mobile_money: Number(r.mobile_money) || 0,
        différés: Number(r.différés) || 0,
        solde_veille: Number(r.solde_veille) || 0,
        observation: r.observation,
      }).eq('id', r.id)
      if (erreurRapport) throw erreurRapport

      // 2. Supprime les sorties retirées
      if (sortiesSupprimées.length > 0) {
        const { error: erreurSuppr } = await supabase.from('sorties').delete().in('id', sortiesSupprimées)
        if (erreurSuppr) throw erreurSuppr
      }

      // 3. Met à jour ou insère chaque ligne de sortie
      for (const ligne of lignesSorties) {
        if (!ligne.libellé || !ligne.montant) continue
        if (ligne.id) {
          const { error } = await supabase.from('sorties').update({
            libellé: ligne.libellé,
            montant: ligne.montant,
            catégorie: ligne.catégorie,
            categorie_depense: ligne.categorie_depense || null,
          }).eq('id', ligne.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('sorties').insert({
            rapport_id: r.id,
            libellé: ligne.libellé,
            montant: ligne.montant,
            catégorie: ligne.catégorie,
            categorie_depense: ligne.categorie_depense || null,
          })
          if (error) throw error
        }
      }

      setRapportSelectionné(null)
      setLignesSorties([])
      setSortiesSupprimées([])
      chargerRapports()
    } catch (err) {
      alert('Erreur lors de la sauvegarde : ' + err.message)
    } finally {
      setEnregistrementEnCours(false)
    }
  }

  const responsablesDuMagasin = rapportSelectionné
    ? profils.filter(p => p.magasin_id === rapportSelectionné.magasin_id)
    : []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Historique des rapports</h1>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow flex flex-wrap gap-2">
        <input placeholder="Rechercher..." value={recherche} onChange={(e) => setRecherche(e.target.value)} className="input-big flex-1 min-w-[150px]" />
        <select value={filtreMagasin} onChange={(e) => setFiltreMagasin(e.target.value)} className="input-big w-auto">
          <option value="">Tous les magasins</option>
          {magasins.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <input type="date" value={filtreDate} onChange={(e) => setFiltreDate(e.target.value)} className="input-big w-auto" />
      </div>

      <div className="flex gap-2">
        <button onClick={() => exporterExcel(rapportsFiltrés)} className="btn-big bg-primary-600 text-white flex items-center gap-2 text-sm py-2 px-4">
          <FileSpreadsheet size={16} /> Excel
        </button>
        <button onClick={() => exporterCSV(rapportsFiltrés)} className="btn-big bg-primary-600 text-white flex items-center gap-2 text-sm py-2 px-4">
          <Download size={16} /> CSV
        </button>
        <button onClick={() => exporterPDF(rapportsFiltrés)} className="btn-big bg-primary-600 text-white flex items-center gap-2 text-sm py-2 px-4">
          <FileText size={16} /> PDF
        </button>
      </div>

      {loading ? <p>Chargement...</p> : (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl shadow">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <th className="p-3">Date</th><th className="p-3">Magasin</th><th className="p-3">Responsable</th>
                <th className="p-3">Espèces</th><th className="p-3">Chèque</th><th className="p-3">Mobile Money</th>
                <th className="p-3">Différés</th><th className="p-3">Encaissements</th><th className="p-3">Sorties</th>
                <th className="p-3">Résultat</th><th className="p-3">Solde</th><th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rapportsFiltrés.map((r) => (
                <tr key={r.id} className="border-b dark:border-gray-700">
                  <td className="p-3">{r.date}</td>
                  <td className="p-3">{r.magasins?.nom}</td>
                  <td className="p-3">{r.profils?.nom}</td>
                  <td className="p-3">{Number(r.espèces).toLocaleString()}</td>
                  <td className="p-3">{Number(r.chèque).toLocaleString()}</td>
                  <td className="p-3">{Number(r.mobile_money).toLocaleString()}</td>
                  <td className="p-3">{Number(r.différés).toLocaleString()}</td>
                  <td className="p-3 text-primary-700 dark:text-primary-400">{Number(r.total_encaissements || 0).toLocaleString()}</td>
                  <td className="p-3">{Number(r.total_sorties).toLocaleString()}</td>
                  <td className="p-3 font-semibold">{Number(r.résultat).toLocaleString()}</td>
                  <td className={`p-3 font-semibold ${rapportEnAttenteDeVersement(r) ? 'text-red-500' : ''}`}>
                    {Number(r.solde).toLocaleString()}
                  </td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => apercuRapportUniquePDF(r)}><Eye size={18} /></button>
                    <button onClick={() => ouvrirModaleEdition(r)}><Pencil size={18} /></button>
                    <button onClick={() => supprimerRapport(r.id)} className="text-red-500"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rapportSelectionné && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-lg space-y-3 my-8">
            <h2 className="font-bold text-lg">Modifier le rapport</h2>

            <label className="text-sm">Date</label>
            <input
              type="date"
              className="input-big w-full"
              value={rapportSelectionné.date}
              onChange={(e) => setRapportSelectionné({ ...rapportSelectionné, date: e.target.value })}
            />

            <label className="text-sm">Magasin</label>
            <select
              className="input-big w-full"
              value={rapportSelectionné.magasin_id}
              onChange={(e) => setRapportSelectionné({ ...rapportSelectionné, magasin_id: e.target.value, responsable_id: '' })}
            >
              {magasins.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>

            <label className="text-sm">Responsable</label>
            <select
              className="input-big w-full"
              value={rapportSelectionné.responsable_id}
              onChange={(e) => setRapportSelectionné({ ...rapportSelectionné, responsable_id: e.target.value })}
            >
              <option value="">-- Sélectionner --</option>
              {responsablesDuMagasin.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>

            <label className="text-sm">Espèces</label>
            <MontantInput className="input-big" value={rapportSelectionné.espèces}
              onChange={(v) => setRapportSelectionné({ ...rapportSelectionné, espèces: v })} />
            <label className="text-sm">Chèque</label>
            <MontantInput className="input-big" value={rapportSelectionné.chèque}
              onChange={(v) => setRapportSelectionné({ ...rapportSelectionné, chèque: v })} />
            <label className="text-sm">Mobile Money</label>
            <MontantInput className="input-big" value={rapportSelectionné.mobile_money}
              onChange={(v) => setRapportSelectionné({ ...rapportSelectionné, mobile_money: v })} />
            <label className="text-sm">Différés</label>
            <MontantInput className="input-big" value={rapportSelectionné.différés}
              onChange={(v) => setRapportSelectionné({ ...rapportSelectionné, différés: v })} />
            <label className="text-sm">Solde veille</label>
            <MontantInput className="input-big" value={rapportSelectionné.solde_veille}
              onChange={(v) => setRapportSelectionné({ ...rapportSelectionné, solde_veille: v })} />

            <div>
              <label className="text-sm block">Encaissements clients (dettes anciennes)</label>
              <p className="input-big w-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed">
                {Number(rapportSelectionné.total_encaissements || 0).toLocaleString()} Ar
              </p>
              <a href="/creances" className="text-xs text-primary-600 flex items-center gap-1 mt-1">
                <ExternalLink size={12} /> Modifier via la page Créances
              </a>
            </div>

            <div>
              <label className="text-sm block mb-2">Sorties</label>
              <div className="space-y-2">
                {lignesSorties.map((ligne, index) => (
                  <div key={ligne.id || `nouvelle-${index}`} className="border rounded p-2 space-y-1 bg-gray-50 dark:bg-gray-900">
                    <div className="flex gap-2">
                      <input
                        placeholder="Libellé"
                        value={ligne.libellé}
                        onChange={(e) => modifierLigneSortie(index, 'libellé', e.target.value)}
                        className="input-big flex-1 text-sm"
                      />
                      <button type="button" onClick={() => supprimerLigneSortie(index)} className="text-red-500 px-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <MontantInput
                        className="input-big flex-1 text-sm"
                        value={ligne.montant}
                        onChange={(v) => modifierLigneSortie(index, 'montant', v)}
                      />
                      <select
                        value={ligne.catégorie}
                        onChange={(e) => modifierLigneSortie(index, 'catégorie', e.target.value)}
                        className="input-big text-sm"
                      >
                        <option value="dépense">Dépense</option>
                        <option value="versement">Versement</option>
                      </select>
                    </div>
                    {ligne.catégorie === 'dépense' && (
                      <input
                        placeholder="Catégorie de dépense (ex: frais mvola, sakafo...)"
                        value={ligne.categorie_depense || ''}
                        onChange={(e) => modifierLigneSortie(index, 'categorie_depense', e.target.value)}
                        className="input-big w-full text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={ajouterLigneSortie} className="mt-2 flex items-center gap-1 text-sm text-primary-600">
                <Plus size={16} /> Ajouter une sortie
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Total sorties recalculé : {totalSortiesCalculé.toLocaleString()} Ar
              </p>
            </div>

            <label className="text-sm">Observation</label>
            <textarea className="input-big w-full" value={rapportSelectionné.observation || ''}
              onChange={(e) => setRapportSelectionné({ ...rapportSelectionné, observation: e.target.value })} />

            <div className="flex gap-2 pt-2">
              <button onClick={sauvegarderModification} disabled={enregistrementEnCours} className="btn-big bg-primary-600 text-white flex-1 disabled:opacity-50">
                {enregistrementEnCours ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setRapportSelectionné(null)} className="btn-big bg-gray-300 dark:bg-gray-700 flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
