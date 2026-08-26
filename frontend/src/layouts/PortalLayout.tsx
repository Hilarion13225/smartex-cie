import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAppStore } from '../stores/app'

export interface PortalNavItem { to: string; label: string; icon: string; end?: boolean }

export default function PortalLayout({ title, items, accent = 'CIE' }: { title: string; items: PortalNavItem[]; accent?: string }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const token = useAppStore((s) => s.token)
  const clearSession = useAppStore((s) => s.clearSession)

  // Même garde que ClientLayout (voir sa note) : /cie/** et /admin/** restaient accessibles
  // en tapant l'URL sans être connecté.
  if (!token) return <Navigate to="/" replace />

  return (
    <div className="min-h-full flex flex-col lg:flex-row">
      {/* Sidebar - Hidden on mobile, visible on lg+ */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-navy-900 text-gray-300 flex flex-col transition-transform lg:static lg:translate-x-0 lg:z-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <img src="/logos/cie-logo.jpg" alt="CIE" className="h-8 object-contain rounded-lg" />
            <span className="text-white font-semibold text-sm">{accent}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">✕</button>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm rounded-r-full mr-4 transition ${
                  isActive ? 'bg-white/10 text-white font-semibold' : 'hover:bg-white/5'
                }`
              }
            >
              <span>{i.icon}</span>
              <span>{i.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => { clearSession(); navigate('/') }}
          className="flex items-center gap-3 px-5 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white border-t border-white/10 mr-4 rounded-r-full transition"
        >
          <span>🚪</span>
          <span>Se déconnecter</span>
        </button>
      </aside>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between sticky top-0 z-20 gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 text-xl"
          >
            ☰
          </button>
          <h1 className="font-bold text-gray-900 text-lg lg:text-xl">{title}</h1>
          <div className="flex items-center gap-2 lg:gap-4">
            <span className="text-gray-400">🔔</span>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs lg:text-sm text-gray-600">Admin</span>
              <span className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-cie-100 text-cie-700 flex items-center justify-center text-xs lg:text-sm font-bold">A</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-3 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
