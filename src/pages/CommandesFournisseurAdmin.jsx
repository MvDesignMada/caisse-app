import { useState, useEffect } from 'react'
import { AlertTriangle, FileWarning, Clock, List, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'

const SEUIL_JOURS_FACTURE = 7

function formatAr(valeur) {
  return Number(valeur || 0).toLocaleString('en-US') + ' Ar'
}

export default function CommandesFournisseurAdmin() {
  const [commandes, setCommandes] = useState([])
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState('ecarts_devis')

  useEffect(() => { chargerCommandes() }, [])

  async function chargerCommandes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('commandes_fournisseur')
      .select('*, clients(nom, telephone), profils(nom), magasins(nom)')
      .order('date_commande', { ascending: false })

    if (!error) setCommandes(data || [])
    setLoading(false)
  }

  const aujourdHui = new Date()

  const ecartsDevis = commandes.filter(c => Number(c.ecart_devis_commande) !== 0)

  const ecartsFacture = commandes.filter(
    c => c.montant_facture !== null && Number(c.montant_bon_commande) - Number(c.montant_facture) !== 0
  )

  const sansFacture = commandes.filter(c => {
    if (c.facture_url || c.statut === 'annulée') return false
    const joursEcoules = Math.floor((aujourdHui - new Date(c.date_commande)) / 86400000)
    return joursEcoules >= SEUIL_JOURS_FACTURE
  })

  const onglets = [
    { id: 'ecarts_devis', label: 'Écarts devis / commande', icone: AlertTriangle, liste: ecartsDevis, couleur: 'text-orange-500' },
    { id: 'ecarts_facture', label: 'Écarts commande / facture', icone: FileWarning, liste: ecartsFacture, couleur: 'text-red-500' },
    { id: 'sans_facture', label: `Sans facture (+${SEUIL_JOURS_FACTURE}j)`, icone: Clock, liste: sansFacture, couleur: 'text-yellow-500' },
    { id: 'toutes', label: 'Toutes les commandes', icone: List, liste: commandes, couleur: 'text-gray-500' },
  ]

  const ongletActif = onglets.find(o => o.id === onglet)

  if (loading) {
    return <div className="text-center p-8">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Suivi des commandes fournisseur</h1>

      {/* Cartes résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {onglets.map(o => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`p-4 rounded-xl border text-left transition ${
              onglet === o.id
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <o.icone className={o.couleur} size={20} />
            <p className="text-2xl font-bold mt-2">{o.liste.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{o.label}</p>
          </button>
        ))}
      </div>

      {/* Tableau détaillé */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700 text-left">
              <th className="p-3">Date</th>
              <th className="p-3">Magasin</th>
              <th className="p-3">Client</th>
              <th className="p-3">Responsable</th>
              <th className="p-3">Devis</th>
              <th className="p-3">Bon commande</th>
              <th className="p-3">Facture</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Justificatifs</th>
            </tr>
          </thead>
          <tbody>
            {ongletActif.liste.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-400">
                  Aucune commande dans cette catégorie.
                </td>
              </tr>
            )}
            {ongletActif.liste.map(c => {
              const joursEcoules = Math.floor((aujourdHui - new Date(c.date_commande)) / 86400000)
              return (
                <tr key={c.id} className="border-b dark:border-gray-700">
                  <td className="p-3 whitespace-nowrap">
                    {c.date_commande}
                    {!c.facture_url && joursEcoules >= SEUIL_JOURS_FACTURE && (
                      <span className="block text-xs text-yellow-600">{joursEcoules} j sans facture</span>
                    )}
                  </td>
                  <td className="p-3">{c.magasins?.nom}</td>
                  <td className="p-3">{c.clients?.nom}</td>
                  <td className="p-3">{c.profils?.nom}</td>
                  <td className="p-3">
                    {formatAr(c.montant_devis)}
                    <a href={c.devis_url} target="_blank" rel="noreferrer" className="block text-xs text-primary-600">
                      <ExternalLink size={12} className="inline" /> voir
                    </a>
                  </td>
                  <td className="p-3">
                    {formatAr(c.montant_bon_commande)}
                    {Number(c.ecart_devis_commande) !== 0 && (
                      <span className="block text-xs text-orange-500">
                        écart {formatAr(c.ecart_devis_commande)}
                      </span>
                    )}
                    <a href={c.bon_commande_url} target="_blank" rel="noreferrer" className="block text-xs text-primary-600">
                      <ExternalLink size={12} className="inline" /> voir
                    </a>
                  </td>
                  <td className="p-3">
                    {c.montant_facture ? formatAr(c.montant_facture) : (
                      <span className="text-gray-400">non reçue</span>
                    )}
                    {c.montant_facture !== null &&
                      Number(c.montant_bon_commande) - Number(c.montant_facture) !== 0 && (
                        <span className="block text-xs text-red-500">
                          écart {formatAr(Number(c.montant_bon_commande) - Number(c.montant_facture))}
                        </span>
                      )}
                    {c.facture_url && (
                      <a href={c.facture_url} target="_blank" rel="noreferrer" className="block text-xs text-primary-600">
                        <ExternalLink size={12} className="inline" /> voir
                      </a>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700">
                      {c.statut}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-400">
                    {c.devis_url && c.bon_commande_url && c.facture_url
                      ? 'Complet'
                      : 'Incomplet'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

