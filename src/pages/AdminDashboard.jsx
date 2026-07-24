import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [evolution, setEvolution] = useState([])
  const [parMagasin, setParMagasin] = useState([])
  const [topDepenses, setTopDepenses] = useState([])
  const [versements, setVersements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { chargerStats(); chargerVersements(); chargerTopDepenses() }, [])

  async function chargerTopDepenses() {
    const { data } = await supabase
      .from('sorties')
      .select('categorie_depense, montant')
      .eq('catégorie', 'dépense')
      .not('categorie_depense', 'is', null)
    if (data) {
      const parCategorie = {}
      data.forEach((s) => {
        parCategorie[s.categorie_depense] = (parCategorie[s.categorie_depense] || 0) + Number(s.montant)
      })
      const trié = Object.entries(parCategorie)
        .map(([categorie, total]) => ({ categorie, total }))
        .sort((a, b) => b.total - a.total)
      setTopDepenses(trié)
    }
  }

  async function chargerVersements() {
    const { data: magasins } = await supabase.from('magasins').select('id, nom')
    const { data: derniers } = await supabase.from('dernier_versement').select('*')
    const combinés = (magasins || []).map((m) => {
      const v = (derniers || []).find((d) => d.magasin_id === m.id)
      return { magasin: m.nom, date_dernier_versement: v?.date_dernier_versement || null }
    })
    setVersements(combinés)
  }

  async function chargerStats() {
    setLoading(true)
    const { data: rapports } = await supabase
      .from('rapports')
      .select('*, magasins(nom)')
      .order('date', { ascending: true })

    if (rapports) {
      const today = new Date().toISOString().split('T')[0]
      const debutSemaine = new Date(); debutSemaine.setDate(debutSemaine.getDate() - 7)
      const debutMois = new Date(); debutMois.setDate(1)

      const ventesAujourdhui = rapports.filter((r) => r.date === today)
        .reduce((s, r) => s + Number(r.total_ventes || 0), 0)
      const ventesSemaine = rapports.filter((r) => new Date(r.date) >= debutSemaine)
        .reduce((s, r) => s + Number(r.total_ventes || 0), 0)
      const ventesMois = rapports.filter((r) => new Date(r.date) >= debutMois)
        .reduce((s, r) => s + Number(r.total_ventes || 0), 0)

      setStats({
        nombreRapports: rapports.length,
        ventesAujourdhui, ventesSemaine, ventesMois,
        totalEspèces: rapports.reduce((s, r) => s + Number(r.espèces || 0), 0),
        totalDifférés: rapports.reduce((s, r) => s + Number(r.différés || 0), 0),
        totalSorties: rapports.reduce((s, r) => s + Number(r.total_sorties || 0), 0),
        totalEncaissements: rapports.reduce((s, r) => s + Number(r.total_encaissements || 0), 0),
      })

      const parDate = {}
      rapports.forEach((r) => {
        parDate[r.date] = (parDate[r.date] || 0) + Number(r.total_ventes || 0)
      })
      setEvolution(Object.entries(parDate).map(([date, ventes]) => ({ date, ventes })))

      const parMag = {}
      rapports.forEach((r) => {
        const nom = r.magasins?.nom || 'Inconnu'
        parMag[nom] = (parMag[nom] || 0) + Number(r.total_ventes || 0)
      })
      setParMagasin(Object.entries(parMag).map(([magasin, ventes]) => ({ magasin, ventes })))
    }
    setLoading(false)
  }

  if (loading) return <p className="text-center mt-10">Chargement...</p>

  const cartes = [
    { label: 'Rapports', valeur: stats.nombreRapports },
    { label: 'Ventes aujourd\'hui', valeur: stats.ventesAujourdhui },
    { label: 'Ventes semaine', valeur: stats.ventesSemaine },
    { label: 'Ventes mois', valeur: stats.ventesMois },
    { label: 'Total espèces', valeur: stats.totalEspèces },
    { label: 'Total différés', valeur: stats.totalDifférés },
    { label: 'Total sorties', valeur: stats.totalSorties },
    { label: 'Encaissements clients (dettes anciennes)', valeur: stats.totalEncaissements },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cartes.map((c) => (
          <div key={c.label} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
            <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
            <p className="text-xl font-bold text-primary-700 dark:text-primary-400">
              {typeof c.valeur === 'number' && c.label !== 'Rapports' ? c.valeur.toLocaleString() + ' Ar' : c.valeur}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
        <h2 className="font-semibold mb-3">Cash non versé</h2>
        <div className="space-y-2">
          {versements.map((v) => {
            const jours = v.date_dernier_versement
              ? Math.floor((new Date() - new Date(v.date_dernier_versement)) / 86400000)
              : null
            return (
              <div key={v.magasin} className="flex justify-between text-sm">
                <span>{v.magasin}</span>
                <span className={jours === null || jours > 3 ? 'text-red-500 font-semibold' : 'text-gray-500'}>
                  {v.date_dernier_versement
                    ? `Dernier versement : ${v.date_dernier_versement} (${jours} j)`
                    : 'Aucun versement enregistré'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
        <h2 className="font-semibold mb-3">Top des dépenses par catégorie</h2>
        {topDepenses.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucune dépense catégorisée pour le moment.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, topDepenses.length * 40)}>
            <BarChart data={topDepenses} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="categorie" fontSize={12} width={140} />
              <Tooltip />
              <Bar dataKey="total" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
        <h2 className="font-semibold mb-3">Évolution des ventes</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={evolution}>
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="ventes" stroke="#16a34a" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
        <h2 className="font-semibold mb-3">Comparaison entre magasins</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={parMagasin}>
            <XAxis dataKey="magasin" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Legend />
            <Bar dataKey="ventes" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
