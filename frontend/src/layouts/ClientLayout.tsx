import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Toasts } from '../components/ui'
import { useAppStore } from '../stores/app'

const tabs = [
  { to: '/app', label: 'Accueil', icon: '🏠' },
  { to: '/app/compteur', label: 'Compteur', icon: '⚡' },
  { to: '/app/recharge', label: '', icon: '+', fab: true },
  { to: '/app/transactions', label: 'Transactions', icon: '📊' },
  { to: '/app/profil', label: 'Profil', icon: '👤' },
]

export default function ClientLayout() {
  const navigate = useNavigate()
  const alerts = useAppStore((s) => s.alerts)
  const unread = alerts.filter((a) => !a.read).length
  return (
    <div className="min-h-full max-w-md mx-auto bg-[#f6f8fa] relative pb-20">
      <Toasts />
      <header className="sticky top-0 z-20 bg-white border-b-2 border-orange-400 px-4 py-3 flex items-center justify-between">
        <img src="/logos/cie-logo.jpg" alt="CIE" className="h-8 object-contain" />
        <NavLink
          to="/app/alertes"
          className={({ isActive }) =>
            `relative p-2 text-xl inline-block transition ${isActive ? 'text-orange-600' : 'text-orange-500'}`
          }
          style={unread > 0 ? { animation: 'shake 0.5s infinite' } : {}}
        >
          🔔
          {unread > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-pulse font-bold">{unread}</span>
          )}
        </NavLink>
      </header>
      <Outlet context={{ unread, openAlerts: () => navigate('/app/alertes') }} />
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-gradient-to-r from-white via-orange-50 to-white border-t-2 border-orange-400 flex items-end justify-around px-2 pt-2 pb-2 z-30">
        {tabs.map((t) =>
          t.fab ? (
            <NavLink key={t.to} to={t.to} className="relative -top-4">
              <span className="w-14 h-14 rounded-full bg-cie-600 text-white text-3xl font-light flex items-center justify-center shadow-lg shadow-cie-600/30">+</span>
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
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ),
        )}
      </nav>
    </div>
  )
}
