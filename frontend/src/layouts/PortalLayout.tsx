import { NavLink, Outlet } from 'react-router-dom'
import { CieLogo, Toasts } from '../components/ui'

export interface PortalNavItem { to: string; label: string; icon: string; end?: boolean }

export default function PortalLayout({ title, items, accent = 'CIE' }: { title: string; items: PortalNavItem[]; accent?: string }) {
  return (
    <div className="min-h-full flex">
      <Toasts />
      <aside className="w-60 shrink-0 bg-navy-900 text-gray-300 flex flex-col min-h-screen sticky top-0">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
          <span className="bg-white rounded-lg px-2 py-1"><CieLogo size="sm" /></span>
          <span className="text-white font-semibold text-sm">{accent}</span>
        </div>
        <nav className="flex-1 py-4 space-y-0.5">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm rounded-r-full mr-4 transition ${
                  isActive ? 'bg-white/10 text-white font-semibold' : 'hover:bg-white/5'
                }`
              }
            >
              <span>{i.icon}</span>
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-[10px] text-gray-500 border-t border-white/10">
          PoC — données simulées (MOCK)
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <h1 className="font-bold text-gray-900">{title}</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">🔔</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Admin CIE</span>
              <span className="w-8 h-8 rounded-full bg-cie-100 text-cie-700 flex items-center justify-center text-sm font-bold">A</span>
            </div>
          </div>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
