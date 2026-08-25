import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useAppStore } from '../../stores/app'
import type { Meter } from '../../types'
import { fmtFcfa, fmtKwh } from '../../types'
import { Badge, Card, CreditStatusBadge, MeterStatusBadge, Skeleton } from '../../components/ui'

function CreditRing({ percent }: { percent: number }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 64 64" className="w-16 h-16">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">{percent}%</text>
    </svg>
  )
}

export function ClientDashboard() {
  const navigate = useNavigate()
  const customer = useAppStore((s) => s.customer)
  const alerts = useAppStore((s) => s.alerts)
  const [meter, setMeter] = useState<Meter | null>(null)

  useEffect(() => {
    api.getMeter(customer?.meterId ?? 'MTR-458921').then(setMeter)
  }, [customer])

  const unread = alerts.filter((a) => !a.read)
  const lastAlert = unread[0] ?? alerts[0]

  return (
    <div>
      <div className="flex items-center justify-between px-5 pt-5">
        <h1 className="text-xl font-bold text-gray-900">Bonjour, {customer?.firstName ?? 'Jean'} 👋</h1>
        <Link to="/app/alertes" className="relative text-xl">
          🔔
          {unread.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center">{unread.length}</span>}
        </Link>
      </div>

      <div className="px-5 mt-4 space-y-4">
        {!meter ? (
          <>
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </>
        ) : (
          <>
            <Card className="p-4 flex items-center justify-between animate-slide-up">
              <div>
                <p className="text-[11px] text-gray-400">Compteur</p>
                <p className="font-bold text-gray-900">{meter.meterId}</p>
              </div>
              <MeterStatusBadge status={meter.status} />
            </Card>

            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 flex items-center justify-between shadow-lg shadow-blue-600/20 animate-slide-up">
              <div>
                <p className="text-xs text-blue-100">Crédit restant</p>
                <p className="text-3xl font-extrabold mt-1">{fmtFcfa(meter.creditFcfa)}</p>
                <p className="text-sm text-blue-100 mt-1">≈ {fmtKwh(meter.creditKwh)}</p>
              </div>
              <CreditRing percent={meter.creditPercent} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-[11px] text-gray-400">Autonomie estimée</p>
                <p className="font-bold text-gray-900 text-lg">{meter.autonomyDays} jours</p>
              </Card>
              <Card className="p-4 flex flex-col justify-between">
                <p className="text-[11px] text-gray-400">Statut</p>
                <div><CreditStatusBadge status={meter.creditStatus} /></div>
              </Card>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: '🔋', label: 'Recharger', to: '/app/recharge' },
                { icon: '🧾', label: 'Historique', to: '/app/transactions' },
                { icon: '📊', label: 'Consommation', to: '/app/consommation' },
                { icon: '⋯', label: 'Plus', to: '/app/profil' },
              ].map((a) => (
                <button key={a.label} onClick={() => navigate(a.to)} className="flex flex-col items-center gap-1.5">
                  <span className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-xl">{a.icon}</span>
                  <span className="text-[10px] text-gray-500">{a.label}</span>
                </button>
              ))}
            </div>

            {lastAlert && (
              <Card className="p-4 border-l-4 border-l-orange-400 bg-orange-50/50">
                <div className="flex items-start gap-3">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">Alerte active</p>
                    <p className="text-xs text-gray-500 mt-0.5">{lastAlert.message}</p>
                    <Link to="/app/alertes" className="text-xs text-cie-600 font-semibold mt-1 inline-block">Voir toutes les alertes →</Link>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function MeterPage() {
  const navigate = useNavigate()
  const customer = useAppStore((s) => s.customer)
  const [meter, setMeter] = useState<Meter | null>(null)

  useEffect(() => {
    api.getMeter(customer?.meterId ?? 'MTR-458921').then(setMeter)
  }, [customer])

  return (
    <div>
      <div className="px-5 pt-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Mon compteur</h1>
        <button onClick={() => navigate('/app/demo')} className="text-[10px] text-gray-400 border border-gray-200 rounded-full px-2 py-1">Mode démo</button>
      </div>
      <div className="px-5 mt-4 space-y-4">
        {!meter ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <>
            <Card className="p-5 animate-slide-up">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-lg">{meter.meterId}</p>
                  <p className="text-xs text-gray-400">{meter.location} · Dongle {meter.deviceId}</p>
                </div>
                <MeterStatusBadge status={meter.status} />
              </div>
              <div className="grid grid-cols-2 gap-y-4 mt-5 text-sm">
                <div><p className="text-[11px] text-gray-400">Dernier heartbeat</p><p className="font-semibold">{new Date(meter.lastHeartbeat).toLocaleTimeString('fr-FR')}</p></div>
                <div><p className="text-[11px] text-gray-400">Tension</p><p className="font-semibold">{meter.voltage} V</p></div>
                <div><p className="text-[11px] text-gray-400">Courant</p><p className="font-semibold">{meter.current} A</p></div>
                <div><p className="text-[11px] text-gray-400">Conso aujourd’hui</p><p className="font-semibold">{fmtKwh(meter.consumptionTodayKwh)}</p></div>
                <div><p className="text-[11px] text-gray-400">Crédit</p><p className="font-semibold">{fmtFcfa(meter.creditFcfa)}</p></div>
                <div><p className="text-[11px] text-gray-400">Alertes</p><p className="font-semibold">{meter.alertCount}</p></div>
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">Connectivité IoT (simulée)</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Compteur</span><span className="flex-1 border-t border-dashed border-gray-300 mx-2" />
                <span>Dongle</span><span className="flex-1 border-t border-dashed border-gray-300 mx-2" />
                <span>MQTT/TLS</span><span className="flex-1 border-t border-dashed border-gray-300 mx-2" />
                <span>Plateforme</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge color={meter.status === 'ONLINE' ? 'green' : 'red'}>{meter.status === 'ONLINE' ? 'Liaison active' : 'Liaison interrompue'}</Badge>
                <span className="text-[10px] text-gray-400">MOCK — le navigateur ne se connecte pas au broker réel</span>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
