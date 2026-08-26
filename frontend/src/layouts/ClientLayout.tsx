import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAppStore } from '../stores/app'
import { IconHome, IconMeter, IconTransaction, IconProfile, IconBell, IconPlus } from '../components/icons'

const tabs = [
  { to: '/app', label: 'Accueil', icon: 'home', end: true },
  { to: '/app/compteur', label: 'Compteur', icon: 'meter', end: false },
  { to: '/app/recharge', label: '', icon: 'plus', fab: true, end: false },
  { to: '/app/transactions', label: 'Transactions', icon: 'transaction', end: false },
  { to: '/app/profil', label: 'Profil', icon: 'profile', end: false },
]

const iconComponents: Record<string, React.ReactNode> = {
  home: <IconHome />,
  meter: <IconMeter />,
  transaction: <IconTransaction />,
  profile: <IconProfile />,
}

export default function ClientLayout() {
  const navigate = useNavigate()
  const alerts = useAppStore((s) => s.alerts)
  const setAlerts = useAppStore((s) => s.setAlerts)
  const token = useAppStore((s) => s.token)
  const customer = useAppStore((s) => s.customer)
  const setCustomer = useAppStore((s) => s.setCustomer)
  const unread = alerts.filter((a) => !a.read).length

  useEffect(() => { api.listAlerts().then(setAlerts) }, [setAlerts])
  // Le JWT survit à un F5 (sessionStorage), mais `customer` est un simple état mémoire,
  // jamais réhydraté jusqu'ici -- tout ce qui dépend de customer.customerId (transactions,
  // createRecharge...) se comportait donc comme "non connecté" dès le premier rechargement
  // de page suivant une connexion, silencieusement (pas d'erreur, juste des listes vides).
  // Erreur ignorée : un 401 déclenche déjà clearSession() dans httpClient, un problème
  // réseau ne doit pas empêcher le reste de la page de s'afficher.
  useEffect(() => {
    if (token && !customer) { api.getMe().then(setCustomer).catch(() => {}) }
  }, [token, customer, setCustomer])

  // Aucune garde de route jusqu'ici : /app/** restait accessible en tapant l'URL même sans
  // token (sessionStorage vide ou expiré), affichant un dashboard vide/cassé au lieu de
  // renvoyer vers la connexion -- l'app supposait "connecté" dès que les appels API
  // réussissaient, jamais l'inverse.
  if (!token) return <Navigate to="/" replace />

  return (
    <div className="min-h-full bg-[#f6f8fa] relative">
      <div className="mx-auto max-w-7xl lg:flex">
        {/* Header Desktop */}
        <header className="sticky top-0 z-20 bg-white border-b-2 lg:border-b-0 lg:border-r-2 border-orange-400 px-4 py-3 lg:py-4 flex lg:flex-col items-center lg:items-start justify-between lg:justify-start lg:w-64 lg:h-screen">
          <img src="/logos/cie-logo.jpg" alt="CIE" className="h-8 lg:h-10 object-contain" />
          <NavLink
            to="/app/alertes"
            className={({ isActive }) =>
              `relative p-2 inline-block transition ${isActive ? 'text-orange-600' : 'text-orange-500'}`
            }
            style={unread > 0 ? { animation: 'shake 0.5s infinite' } : {}}
          >
            <span className="w-6 h-6"><IconBell /></span>
            {unread > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-pulse font-bold">{unread}</span>
            )}
          </NavLink>
        </header>

        {/* Main Content */}
        <main className="flex-1 lg:pb-0 pb-20">
          <Outlet context={{ unread, openAlerts: () => navigate('/app/alertes') }} />
        </main>
      </div>

      {/* Bottom Nav - Mobile Only */}
      <nav className="fixed lg:hidden bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-gradient-to-r from-white via-orange-50 to-white border-t-2 border-orange-400 flex items-end justify-around px-2 pt-2 pb-2 z-30">
        {tabs.map((t) =>
          t.fab ? (
            <NavLink key={t.to} to={t.to} className="relative -top-4">
              <span className="w-14 h-14 rounded-full bg-cie-600 text-white flex items-center justify-center shadow-lg shadow-cie-600/30"><IconPlus /></span>
            </NavLink>
          ) : (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 text-[10px] font-medium px-2 py-1 rounded-lg ${isActive ? 'text-cie-600' : 'text-gray-400'}`
              }
            >
              <span className="w-6 h-6">{iconComponents[t.icon]}</span>
              {t.label}
            </NavLink>
          ),
        )}
      </nav>

      {/* Desktop Sidebar Nav */}
      <nav className="hidden lg:flex fixed left-0 top-16 h-screen w-64 flex-col bg-white border-r-2 border-orange-400 py-6 px-4 z-30 gap-2">
        {tabs.map((t) =>
          t.fab ? (
            <NavLink key={t.to} to={t.to} className="mb-4">
              <span className="w-12 h-12 rounded-full bg-cie-600 text-white flex items-center justify-center shadow-lg shadow-cie-600/30 mx-auto"><IconPlus /></span>
            </NavLink>
          ) : (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition ${isActive ? 'bg-cie-50 text-cie-600 border-l-4 border-cie-600' : 'text-gray-600 hover:bg-gray-50'}`
              }
            >
              <span className="w-6 h-6">{iconComponents[t.icon]}</span>
              <span>{t.label}</span>
            </NavLink>
          ),
        )}
      </nav>
    </div>
  )
}
