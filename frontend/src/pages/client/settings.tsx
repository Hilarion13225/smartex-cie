import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/app'
import { mqttMock } from '../../services/mqttMock'
import { fmtFcfa } from '../../types'
import type { NotificationPrefs } from '../../types'
import { Button, Card, PageHeader, SeverityDot, Toggle } from '../../components/ui'

export function AlertsPage() {
  const navigate = useNavigate()
  const { alerts, markAllRead, removeAlert, prefs, setPref } = useAppStore()

  const prefRows: { key: keyof NotificationPrefs; label: string }[] = [
    { key: 'lowCredit', label: 'Crédit faible' },
    { key: 'criticalCredit', label: 'Crédit critique' },
    { key: 'overvoltage', label: 'Surtension' },
    { key: 'rechargeSuccess', label: 'Recharge réussie' },
    { key: 'paymentFailed', label: 'Paiement échoué' },
    { key: 'meterOffline', label: 'Compteur offline' },
  ]

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <PageHeader
        title="Alertes & Sécurité"
        onBack={() => navigate('/app')}
        right={<button onClick={markAllRead} className="text-xs text-cie-600 font-semibold">Tout lire</button>}
      />
      <div className="px-5 py-4 space-y-4">
        <div className="space-y-2.5">
          {alerts.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Aucune alerte pour le moment.</p>
          )}
          {alerts.map((a) => (
            <Card key={a.alertId} className={`p-4 flex items-start gap-3 ${!a.read ? 'border-l-4 border-l-cie-500' : ''}`}>
              <SeverityDot severity={a.severity} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{a.type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.message}</p>
                <p className="text-[10px] text-gray-400 mt-1">{new Date(a.createdAt).toLocaleString('fr-FR')} · {a.meterId}</p>
              </div>
              <button
                onClick={() => removeAlert(a.alertId)}
                aria-label="Supprimer l'alerte"
                title="Supprimer"
                className="text-gray-300 hover:text-red-500 text-lg leading-none px-1 flex-shrink-0"
              >
                🗑
              </button>
            </Card>
          ))}
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Notifications</p>
            <Toggle on={prefs.master} onChange={(v) => setPref('master', v)} />
          </div>
          <div className={`mt-3 space-y-3 ${!prefs.master ? 'opacity-40 pointer-events-none' : ''}`}>
            {prefRows.map((r) => (
              <div key={r.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{r.label}</span>
                <Toggle on={prefs[r.key]} onChange={(v) => setPref(r.key, v)} />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">Anti-spam : une même alerte n’est pas répétée sauf aggravation de la criticité.</p>
        </Card>
      </div>
    </div>
  )
}

export function AutoRechargePage() {
  const navigate = useNavigate()
  const { autoRecharge, setAutoRecharge, notify } = useAppStore()

  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <PageHeader title="Auto-recharge" onBack={() => navigate(-1)} />
      <div className="px-5 py-4 space-y-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Auto-recharge</p>
            <p className="text-xs text-gray-400">{autoRecharge.enabled ? 'Activée' : 'Désactivée'}</p>
          </div>
          <Toggle
            on={autoRecharge.enabled}
            onChange={(v) => {
              setAutoRecharge({ enabled: v })
              notify(v ? 'Auto-recharge activée' : 'Auto-recharge désactivée', v ? 'Recharge automatique dès que le seuil est atteint.' : 'Vous pouvez la réactiver à tout moment.', v ? 'SUCCESS' : 'INFO')
            }}
          />
        </Card>
        <Card className={`px-4 ${!autoRecharge.enabled ? 'opacity-50' : ''}`}>
          {row('Déclencher lorsque crédit <', fmtFcfa(autoRecharge.thresholdFcfa))}
          {row('Montant', fmtFcfa(autoRecharge.amountFcfa))}
          {row('Moyen de paiement', 'Wave')}
          {row('Plafond journalier', fmtFcfa(autoRecharge.dailyCapFcfa))}
          {row('Plafond mensuel', fmtFcfa(autoRecharge.monthlyCapFcfa))}
        </Card>
        <p className="text-[10px] text-gray-400">L’auto-recharge reste désactivable et plafonnée. États simulés : enabled, disabled, threshold reached, payment pending, payment failed, recharge completed, cap reached.</p>
      </div>
    </div>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { customer, clearSession } = useAppStore()
  const items = [
    { label: '🔔 Alertes & notifications', to: '/app/alertes' },
    { label: '🔁 Auto-recharge', to: '/app/auto-recharge' },
    { label: '🎟️ Mes tokens', to: '/app/tokens' },
    { label: '📊 Consommation', to: '/app/consommation' },
  ]
  return (
    <div>
      <div className="px-5 pt-5"><h1 className="text-xl font-bold text-gray-900">Profil</h1></div>
      <div className="px-5 mt-4 space-y-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-50 via-white to-green-50 border-2 border-orange-300 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-green-500 text-white flex items-center justify-center text-xl font-bold">
            ⚡
          </div>
          <div>
            <p className="font-bold text-gray-900">{customer ? `${customer.firstName} ${customer.lastName}` : 'Jean KOUADIO'}</p>
            <p className="text-xs text-orange-600 font-semibold">{customer?.phone ?? '07 08 56 78 90'}</p>
            <p className="text-xs text-green-700">MTR {customer?.meterId?.slice(-6) ?? '458921'}</p>
          </div>
        </div>
        <Card>
          {items.map((i) => (
            <button key={i.to} onClick={() => navigate(i.to)} className="w-full flex items-center justify-between px-4 py-3.5 text-sm border-b border-gray-50 last:border-0">
              <span>{i.label}</span><span className="text-gray-300">›</span>
            </button>
          ))}
        </Card>
        <Button variant="secondary" className="w-full" onClick={() => { clearSession(); navigate('/') }}>Se déconnecter</Button>
        <p className="text-[10px] text-gray-400 text-center">PoC — profil et données simulés (MOCK)</p>
      </div>
    </div>
  )
}

export function DemoPage() {
  const navigate = useNavigate()
  const { notify } = useAppStore()
  const meterId = 'MTR-458921'

  // notify() enregistre aussi l'alerte automatiquement (voir stores/app.ts).
  const fire = (label: string, severity: 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'INFO', type: string, message: string) => {
    mqttMock.emit(type as never, meterId, {})
    notify(label, message, severity, type, meterId)
  }

  const actions: [string, () => void][] = [
    ['Simuler crédit faible', () => fire('Crédit faible', 'WARNING', 'LOW_CREDIT', 'Votre crédit est inférieur à 2 000 FCFA')],
    ['Simuler surtension', () => fire('Surtension', 'CRITICAL', 'OVERVOLTAGE', 'Surtension détectée : 252 V')],
    ['Simuler compteur offline', () => fire('Compteur offline', 'CRITICAL', 'METER_OFFLINE', `${meterId} est hors ligne`)],
    ['Simuler paiement réussi', () => fire('Paiement réussi', 'SUCCESS', 'PAYMENT_CONFIRMED', 'Paiement Wave de 5 000 FCFA confirmé')],
    ['Simuler paiement échoué', () => fire('Paiement échoué', 'CRITICAL', 'PAYMENT_FAILED', 'Le paiement Wave a été refusé')],
    ['Simuler token généré', () => fire('Token généré', 'INFO', 'TOKEN_GENERATED', 'Token TK-2026-000185 généré')],
    ['Simuler commande envoyée', () => fire('Commande envoyée', 'INFO', 'COMMAND_SENT', 'Commande transmise au compteur via MQTT (simulé)')],
    ['Simuler ACK', () => fire('ACK reçu', 'SUCCESS', 'COMMAND_ACK', 'Le compteur a confirmé l’application du crédit')],
    ['Simuler échec d’injection', () => fire('Échec injection', 'WARNING', 'INJECTION_FAILED', 'Injection automatique échouée — fallback token disponible')],
    ['Simuler fallback token', () => navigate('/app/recharge/fallback')],
  ]

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <div className="px-5 py-4">
        <p className="text-xs text-gray-500 mb-4">Déclenchez des événements simulés (mock MQTT / event bus) pour démontrer le système sans compteur réel.</p>
        <div className="grid grid-cols-1 gap-2.5">
          {actions.map(([label, fn]) => (
            <Button key={label} variant="secondary" onClick={fn} className="w-full text-left">{label}</Button>
          ))}
        </div>
      </div>
    </div>
  )
}
