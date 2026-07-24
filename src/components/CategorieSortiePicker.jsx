import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function CategorieSortiePicker({ valeur, onChange }) {
  const [catégories, setCatégories] = useState([])
  const [ajoutEnCours, setAjoutEnCours] = useState(false)
  const [nouvelleCatégorie, setNouvelleCatégorie] = useState('')

  useEffect(() => { chargerCatégories() }, [])

  async function chargerCatégories() {
    const { data } = await supabase.from('categories_sorties').select('*').order('nom')
    setCatégories(data || [])
  }

  async function ajouterCatégorie() {
    const nom = nouvelleCatégorie.trim()
    if (!nom) return
    const existante = catégories.find((c) => c.nom.toLowerCase() === nom.toLowerCase())
    if (existante) {
      onChange(existante.nom)
    } else {
      const { data, error } = await supabase.from('categories_sorties').insert({ nom }).select().single()
      if (!error) {
        setCatégories([...catégories, data].sort((a, b) => a.nom.localeCompare(b.nom)))
        onChange(data.nom)
      }
    }
    setNouvelleCatégorie('')
    setAjoutEnCours(false)
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {catégories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.nom)}
            className={`shrink-0 px-4 py-3 rounded-xl text-sm font-medium border-2 transition-colors ${
              valeur === cat.nom
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
            }`}
          >
            {cat.nom}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAjoutEnCours(true)}
          className="shrink-0 px-4 py-3 rounded-xl text-sm font-medium border-2 border-dashed border-gray-400 dark:border-gray-500 text-gray-500 dark:text-gray-400 flex items-center gap-1"
        >
          <Plus size={16} /> Nouvelle
        </button>
      </div>

      {ajoutEnCours && (
        <div className="flex gap-2 mt-2">
          <input
            placeholder="Nom de la nouvelle catégorie" value={nouvelleCatégorie}
            onChange={(e) => setNouvelleCatégorie(e.target.value)}
            className="input-big flex-1"
            autoFocus
          />
          <button onClick={ajouterCatégorie} className="btn-big bg-primary-600 text-white px-4">OK</button>
        </div>
      )}
    </div>
  )
}
