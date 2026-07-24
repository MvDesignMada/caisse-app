import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Moon, Sun, LogOut, LayoutDashboard, History, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Layout({ profil, children }) {
  const [dark, setDark] = useState(false)
  const location = useLocation()

  function toggleDark() {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className="min-h-screen dark:bg-gray-900 dark:text-white">
      <header className="bg-primary-600 text-white p-4 flex items-center justify-between shadow-md">
        <div>
          <p className="font-bold text-lg">Caisse</p>
          <p className="text-xs opacity-90">{profil.nom} · {profil.role === 'admin' ? 'Administrateur' : 'Responsable'}</p>
        </div>
        <div className="flex gap-2 items-center">
          {profil.role === 'admin' && (
            <>
              <Link to="/" className={`p-2 rounded-lg ${location.pathname === '/' ? 'bg-white/20' : ''}`}>
                <LayoutDashboard size={22} />
              </Link>
              <Link to="/historique" className={`p-2 rounded-lg ${location.pathname === '/historique' ? 'bg-white/20' : ''}`}>
                <History size={22} />
              </Link>
              <Link to="/creances" className={`p-2 rounded-lg ${location.pathname === '/creances' ? 'bg-white/20' : ''}`}>
                <Users size={22} />
              </Link>
            </>
          )}
          <button onClick={toggleDark} className="p-2 rounded-lg hover:bg-white/20">
            {dark ? <Sun size={22} /> : <Moon size={22} />}
          </button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 rounded-lg hover:bg-white/20">
            <LogOut size={22} />
          </button>
        </div>
      </header>
      <main className="p-4 max-w-5xl mx-auto">{children}</main>
    </div>
  )
}
