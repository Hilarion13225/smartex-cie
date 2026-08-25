import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, DEFAULT_METER_ID } from '../../services/api'
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
  const lastPaymentAmount = useAppStore((s) => s.lastPaymentAmount)
  const [meter, setMeter] = useState<Meter | null>(null)
  const [showNotif, setShowNotif] = useState(true)

  useEffect(() => {
    // `||` et non `??` : un vrai customer backend a meterId = '' (chaîne vide, pas
    // undefined — aucune association Customer↔Meter n'existe encore, voir docs/05 §8),
    // que la coalescence nulle ne remplace pas.
    api.getMeter(customer?.meterId || DEFAULT_METER_ID).then(setMeter)
    const notifTimer = setTimeout(() => setShowNotif(false), 5000)
    return () => clearTimeout(notifTimer)
  }, [customer])

  const unread = alerts.filter((a) => !a.read)
  const lastAlert = unread[0] ?? alerts[0]

  return (
    <div>
      <div className="px-5 pt-5">
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour <span className="text-orange-600">{customer?.firstName ?? 'Jean'}</span> 👋
        </h1>
      </div>

      {showNotif && (
        <div className="mx-5 mt-4 rounded-xl bg-gradient-to-r from-green-50 to-orange-50 border-2 border-green-400 p-4 animate-slide-up">
          <p className="text-sm font-bold text-green-700">✓ Bienvenue {customer?.firstName} !</p>
          <p className="text-xs text-orange-600 mt-1">Votre espace est prêt - Gérez votre électricité en toute sécurité</p>
        </div>
      )}

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

            <div className="rounded-2xl bg-gradient-to-br from-orange-500 via-orange-400 to-green-500 text-white p-5 flex items-center justify-between shadow-lg shadow-orange-500/30 animate-slide-up">
              <div>
                <p className="text-xs text-white font-semibold">⚡ Crédit restant</p>
                <p className="text-3xl font-extrabold mt-1">{fmtFcfa(meter.creditFcfa + lastPaymentAmount)}</p>
                <p className="text-sm text-white mt-1">≈ {fmtKwh((meter.creditFcfa + lastPaymentAmount) / 1000 * 1.25)}</p>
              </div>
              <CreditRing percent={Math.min(100, ((meter.creditFcfa + lastPaymentAmount) / 50000) * 100)} />
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
    {/* `||` et non `??` : un vrai customer backend a meterId = '' (chaîne vide, pas
        undefined — aucune association Customer↔Meter n'existe encore, voir docs/05 §8),
        que la coalescence nulle ne remplace pas. */}
    api.getMeter(customer?.meterId || DEFAULT_METER_ID).then(setMeter)
  }, [customer])

  return (
    <div>
      <div className="px-5 pt-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Mon compteur</h1>
      </div>
      <div className="px-5 mt-4 space-y-4">
        {!meter ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <>
            <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-50 via-white to-green-50 border-2 border-orange-300 animate-slide-up">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-orange-700 text-lg">⚡ {meter.meterId}</p>
                  <p className="text-xs text-green-600">{meter.location} · {meter.deviceId}</p>
                </div>
                <MeterStatusBadge status={meter.status} />
              </div>
              <div className="grid grid-cols-2 gap-y-4 mt-5 text-sm">
                <div><p className="text-[11px] text-gray-500">Dernier heartbeat</p><p className="font-semibold text-orange-700">{new Date(meter.lastHeartbeat).toLocaleTimeString("fr-FR")}</p></div>
                <div><p className="text-[11px] text-gray-500">Tension</p><p className="font-semibold text-orange-700">{meter.voltage} V</p></div>
                <div><p className="text-[11px] text-gray-500">Courant</p><p className="font-semibold text-orange-700">{meter.current} A</p></div>
                <div><p className="text-[11px] text-gray-500">Conso</p><p className="font-semibold text-green-700">{fmtKwh(meter.consumptionTodayKwh)}</p></div>
                <div><p className="text-[11px] text-gray-500">Crédit</p><p className="font-semibold text-green-700">{fmtFcfa(meter.creditFcfa)}</p></div>
                <div><p className="text-[11px] text-gray-500">Alertes</p><p className="font-semibold text-red-600">{meter.alertCount}</p></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
