import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/app'
import { mqttMock } from '../../services/mqttMock'
import { fmtFcfa } from '../../types'
import type { NotificationPrefs } from '../../types'
import { Button, Card, PageHeader, SeverityDot, Toggle } from '../../components/ui'
import { IconLightning, IconPhone, IconMail, IconChart, IconCreditCard, IconRefresh, IconTicket, IconProfile, IconBell } from '../../components/icons'

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
        onBack={() => navigate(-1)}
        right={<button onClick={markAllRead} className="text-xs text-cie-600 font-semibold">Tout lire</button>}
      />
      <div className="px-5 py-4 space-y-4">
        {/* Alertes */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3 px-1">Alertes récentes ({alerts.length})</h2>
          <div className="space-y-2.5">
            {alerts.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Aucune alerte pour le moment.</p>
            )}
            {alerts.map((a) => (
              <Card key={a.alertId} className={`p-4 flex items-start gap-3 ${!a.read ? 'border-l-4 border-l-cie-500 bg-cie-50' : ''}`}>
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
                  className="text-gray-300 hover:text-red-500 px-1 flex-shrink-0"
                >
                  ✕
                </button>
              </Card>
            ))}
          </div>
        </div>

        {/* Paramètres de notifications */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <div>
              <p className="font-semibold text-sm text-gray-900">Notifications</p>
              <p className="text-xs text-gray-500 mt-1">Gérez vos préférences d'alertes</p>
            </div>
            <Toggle on={prefs.master} onChange={(v) => setPref('master', v)} />
          </div>
          <div className={`space-y-3 ${!prefs.master ? 'opacity-50 pointer-events-none' : ''}`}>
            {prefRows.map((r) => (
              <div key={r.key} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700 font-medium">{r.label}</span>
                <Toggle on={prefs[r.key]} onChange={(v) => setPref(r.key, v)} />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-4 pt-3 border-t border-gray-100">
            Anti-spam : une même alerte n'est pas répétée sauf aggravation de la criticité.
          </p>
        </Card>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { alerts, removeAlert, prefs, setPref, customer } = useAppStore()

  const prefRows: { key: keyof NotificationPrefs; label: string; description: string }[] = [
    { key: 'lowCredit', label: 'Crédit faible', description: 'Alerte quand crédit < 2000 FCFA' },
    { key: 'criticalCredit', label: 'Crédit critique', description: 'Alerte quand crédit < 500 FCFA' },
    { key: 'overvoltage', label: 'Surtension', description: 'Anomalies électriques détectées' },
    { key: 'rechargeSuccess', label: 'Recharge réussie', description: 'Confirmations de paiement' },
    { key: 'paymentFailed', label: 'Paiement échoué', description: 'Erreurs de transaction' },
    { key: 'meterOffline', label: 'Compteur offline', description: 'Perte de connexion au compteur' },
  ]

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <PageHeader title="Paramètres" onBack={() => navigate(-1)} />
      <div className="px-5 py-4 space-y-4">
        {/* Préférences de notifications */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Préférences de notifications</h2>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div>
                <p className="font-semibold text-sm text-gray-900">Activer les notifications</p>
                <p className="text-xs text-gray-500 mt-1">Recevez des alertes en temps réel</p>
              </div>
              <Toggle on={prefs.master} onChange={(v) => setPref('master', v)} />
            </div>
            <div className={`space-y-3 ${!prefs.master ? 'opacity-50 pointer-events-none' : ''}`}>
              {prefRows.map((r) => (
                <div key={r.key} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                    </div>
                    <Toggle on={prefs[r.key]} onChange={(v) => setPref(r.key, v)} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Notifications récentes */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Notifications récentes</h2>
          {alerts.length === 0 ? (
            <Card className="p-4 text-center">
              <p className="text-sm text-gray-400">Aucune notification pour le moment.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((a) => (
                <Card key={a.alertId} className="p-3 flex items-start gap-3">
                  <SeverityDot severity={a.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{a.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">{a.message}</p>
                  </div>
                  <button
                    onClick={() => removeAlert(a.alertId)}
                    className="text-gray-300 hover:text-red-500 flex-shrink-0"
                    title="Supprimer"
                  >
                    ✕
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
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
        <p className="text-[10px] text-gray-400">L'auto-recharge reste désactivable et plafonnée. États simulés : enabled, disabled, threshold reached, payment pending, payment failed, recharge completed, cap reached.</p>
      </div>
    </div>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { customer, setCustomer, alerts } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)

  const customerData = customer || {
    firstName: 'Jean',
    lastName: 'KOUADIO',
    phone: '07 08 56 78 90',
    meterId: '45892123456',
    email: 'jean.kouadio@email.com',
    gender: 'Homme',
  }

  const profileItems = [
    { label: 'Compteur', value: customerData.meterId, icon: IconLightning },
    { label: 'Téléphone', value: customerData.phone, icon: IconPhone },
    { label: 'Email', value: customerData.email, icon: IconMail },
    { label: 'Genre', value: customerData.gender, icon: IconProfile },
  ]

  const menuItems = [
    { label: 'Mes tokens', to: '/app/tokens', icon: IconTicket },
    { label: 'Consommation', to: '/app/consommation', icon: IconChart },
    { label: 'Transactions', to: '/app/transactions', icon: IconCreditCard },
    { label: 'Auto-recharge', to: '/app/auto-recharge', icon: IconRefresh },
    { label: 'Alertes', to: '/app/alertes', icon: IconBell },
  ]

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <div className="px-5 pt-5">
        <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>
        <p className="text-xs text-gray-400 mt-1">Gestion de votre profil et préférences</p>
      </div>

      <div className="px-5 mt-6 space-y-5">
        {/* Carte profil principal */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-50 via-white to-green-50 border-2 border-orange-300">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-green-500 text-white flex items-center justify-center text-3xl font-bold flex-shrink-0">
              <IconLightning />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold text-gray-900">{customerData.firstName} {customerData.lastName}</p>
              <p className="text-sm text-orange-600 font-semibold mt-1">Client Smartex Expertises</p>
              <p className="text-xs text-green-700 font-medium mt-0.5">Numéro de compteur: {customerData.meterId}</p>
            </div>
          </div>
        </div>

        {/* Détails du profil */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Récapitulatif de compte</h2>
          <Card className="overflow-hidden">
            {profileItems.map((item, i) => {
              const Icon = item.icon
              return (
                <div key={item.label} className={`px-4 py-3 flex items-center gap-3 ${i < profileItems.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <span className="text-cie-600 w-5 h-5"><Icon /></span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{item.value}</p>
                  </div>
                </div>
              )
            })}
          </Card>
        </div>

        {/* Menu rapidaccès */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Accès rapide</h2>
          <Card className="overflow-hidden">
            {menuItems.map((item, i) => {
              const Icon = item.icon
              return (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition ${i < menuItems.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-orange-600 w-5 h-5"><Icon /></span>
                    <span className="font-medium text-gray-900">{item.label}</span>
                  </span>
                  <span className="text-gray-300">›</span>
                </button>
              )
            })}
          </Card>
        </div>

        {/* Paramètres */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Paramètres</h2>
          <Card className="overflow-hidden">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm hover:bg-gray-50 transition border-b border-gray-100"
            >
              <span className="flex items-center gap-3">
                <span className="text-orange-600 w-5 h-5"><IconBell /></span>
                <span className="font-medium text-gray-900">Notifications et alertes</span>
              </span>
              <span className={`text-gray-300 transition ${showSettings ? 'rotate-90' : ''}`}>›</span>
            </button>
            {showSettings && (
              <SettingsPreview />
            )}
          </Card>
        </div>

        {/* Actions */}
        <Button variant="secondary" className="w-full" onClick={() => { setCustomer(null); navigate('/') }}>
          Se déconnecter
        </Button>

        {/* Branding */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-500">
            <strong>Smartex Expertises</strong> — Gestion intelligente d'électricité prépayée
          </p>
          <p className="text-[10px] text-gray-400 mt-1">Données sécurisées et chiffrées</p>
        </div>
      </div>
    </div>
  )
}

function SettingsPreview() {
  const { prefs, setPref } = useAppStore()

  const prefRows: { key: keyof NotificationPrefs; label: string }[] = [
    { key: 'lowCredit', label: 'Crédit faible' },
    { key: 'criticalCredit', label: 'Crédit critique' },
    { key: 'overvoltage', label: 'Surtension' },
    { key: 'rechargeSuccess', label: 'Recharge réussie' },
  ]

  return (
    <div className="px-4 py-3 bg-gray-50 space-y-2">
      {prefRows.map((r) => (
        <div key={r.key} className="flex items-center justify-between py-1.5">
          <span className="text-xs text-gray-700">{r.label}</span>
          <Toggle on={prefs[r.key]} onChange={(v) => setPref(r.key, v)} />
        </div>
      ))}
    </div>
  )
}

export function DemoPage() {
  const navigate = useNavigate()
  const { notify } = useAppStore()
  const meterId = 'MTR-458921'

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
    ['Simuler ACK', () => fire('ACK reçu', 'SUCCESS', 'COMMAND_ACK', 'Le compteur a confirmé l\'application du crédit')],
    ['Simuler échec d\'injection', () => fire('Échec injection', 'WARNING', 'INJECTION_FAILED', 'Injection automatique échouée — fallback token disponible')],
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
