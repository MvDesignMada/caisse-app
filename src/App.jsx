import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/useAuth'
import Login from './pages/Login'
import ResponsableForm from './pages/ResponsableForm'
import AdminDashboard from './pages/AdminDashboard'
import Historique from './pages/Historique'
import CreancesAdmin from './pages/CreancesAdmin'
import CommandeFournisseurForm from './pages/CommandeFournisseurForm'
import Layout from './components/Layout'

export default function App() {
  const { session, profil, loading } = useAuth()
  if (loading) {
    return <div className="h-screen flex items-center justify-center text-xl">Chargement...</div>
  }
  if (!session || !profil) {
    return <Login />
  }
  return (
    <BrowserRouter>
      <Layout profil={profil}>
        <Routes>
          {profil.role === 'responsable' ? (
            <>
              <Route path="/" element={<ResponsableForm profil={profil} />} />
              <Route path="/commande-fournisseur" element={<CommandeFournisseurForm profil={profil} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/historique" element={<Historique />} />
              <Route path="/creances" element={<CreancesAdmin />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          )}
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
