import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createSimulatedRecharge } from '../../services/api'
import { mqttMock } from '../../services/mqttMock'
import { useAppStore } from '../../stores/app'
import { useRechargeStore } from '../../stores/recharge'
import { fcfaToKwh, fmtFcfa, MOCK_TARIFF_FCFA_PER_KWH } from '../../types'
import type { PaymentProvider } from '../../types'
import { Button, Card, FullScreenLoader, PageHeader, QrPlaceholder, Spinner } from '../../components/ui'

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000, 25000]

export function RechargeAmount() {
  const navigate = useNavigate()
  const { amount, setAmount } = useRechargeStore()
  const [custom, setCustom] = useState('')
  const effective = custom ? parseInt(custom) || 0 : amount

  return (
    <div>
      <PageHeader title="Choisir un montant" onBack={() => navigate('/app')} />
      <div className="px-5 py-5">
        <p className="text-xs text-gray-500 mb-3">Montant rapide</p>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => { setAmount(a); setCustom('') }}
              className={`rounded-xl px-4 py-3.5 text-sm font-bold border transition ${!custom && amount === a ? 'bg-cie-600 text-white border-cie-600' : 'bg-white border-gray-200 text-gray-800'}`}
            >
              {a.toLocaleString('fr-FR')} FCFA
            </button>
          ))}
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
            placeholder="Autre montant"
            inputMode="numeric"
            className="rounded-xl px-4 py-3.5 text-sm font-semibold border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-cie-500"
          />
        </div>

        <div className="mt-8">
          <p className="text-3xl font-extrabold text-gray-900">{fmtFcfa(effective)}</p>
          <p className="text-gray-500 mt-1">≈ {fcfaToKwh(effective).toFixed(1)} kWh</p>
          <p className="text-[11px] text-gray-400 mt-1">Tarif simulé : {MOCK_TARIFF_FCFA_PER_KWH} F / kWh (configurable — MOCK)</p>
        </div>

        <Button
          disabled={effective < 500}
          onClick={() => { if (custom) setAmount(effective); navigate('/app/recharge/moyen') }}
          className="w-full mt-10"
        >
          Continuer
        </Button>
      </div>
    </div>
  )
}

const PROVIDERS: { id: PaymentProvider; name: string; sub: string; icon: string; bg: string }[] = [
  { id: 'WAVE', name: 'Wave', sub: 'Payer avec Wave', icon: '🐧', bg: 'bg-sky-100' },
  { id: 'ORANGE_MONEY', name: 'Orange Money', sub: 'Payer avec Orange Money', icon: '🟠', bg: 'bg-orange-100' },
  { id: 'MTN_MONEY', name: 'MTN Money', sub: 'Payer avec MTN Money', icon: '🟡', bg: 'bg-yellow-100' },
  { id: 'MOOV_MONEY', name: 'Moov Money', sub: 'Payer avec Moov Money', icon: '🔵', bg: 'bg-blue-100' },
]

export function RechargeMethod() {
  const navigate = useNavigate()
  const { provider, setProvider, amount, setRecharge, setOutcome } = useRechargeStore()
  const customer = useAppStore((s) => s.customer)

  const start = () => {
    const r = createSimulatedRecharge(amount, provider, customer?.meterId ?? 'MTR-458921')
    setRecharge(r)
    setOutcome('success')
    navigate('/app/recharge/paiement')
  }

  return (
    <div>
      <PageHeader title="Choisir un moyen de paiement" onBack={() => navigate(-1)} />
      <div className="px-5 py-5 space-y-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            className={`w-full flex items-center gap-3 rounded-2xl border p-4 bg-white text-left transition ${provider === p.id ? 'border-cie-500 ring-2 ring-cie-100' : 'border-gray-200'}`}
          >
            <span className={`w-11 h-11 rounded-xl ${p.bg} flex items-center justify-center text-xl`}>{p.icon}</span>
            <span className="flex-1">
              <span className="block font-semibold text-gray-900 text-sm">{p.name}</span>
              <span className="block text-xs text-gray-400">{p.sub}</span>
            </span>
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${provider === p.id ? 'border-cie-600 bg-cie-600' : 'border-gray-300'}`}>
              {provider === p.id && <span className="text-white text-[10px]">✓</span>}
            </span>
          </button>
        ))}
        <div className="flex justify-center gap-6 pt-4 text-[10px] text-gray-400">
          <span>🔒 Paiement sécurisé</span><span>⚡ Rapide</span><span>🕒 Disponible 24/7</span>
        </div>
        <Button onClick={start} className="w-full mt-4">Continuer</Button>
      </div>
    </div>
  )
}

export function WavePayment() {
  const navigate = useNavigate()
  const { recharge, setOutcome } = useRechargeStore()
  const [phase, setPhase] = useState<'connect' | 'qr' | 'confirming'>('connect')

  useEffect(() => {
    const t = setTimeout(() => setPhase('qr'), 1600)
    return () => clearTimeout(t)
  }, [])

  if (!recharge) { navigate('/app/recharge'); return null }

  const pay = (ok: boolean) => {
    setPhase('confirming')
    setTimeout(() => {
      if (!ok) { setOutcome('payment_failed'); navigate('/app/recharge/statut') }
      else navigate('/app/recharge/confirme')
    }, 2200)
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      {phase === 'connect' && <FullScreenLoader wave title="Connexion au service de paiement..." subtitle="Simulation Wave — aucun paiement réel" />}
      {phase === 'confirming' && <FullScreenLoader wave title="Paiement en attente..." subtitle="Validation de la transaction Wave (simulée)" />}
      <PageHeader title="Paiement Wave (simulation)" onBack={() => navigate(-1)} />
      <div className="px-5 py-5">
        <Card className="p-4 text-sm space-y-2">
          <div className="flex justify-between"><span className="text-gray-400">Montant</span><b>{fmtFcfa(recharge.amount)}</b></div>
          <div className="flex justify-between"><span className="text-gray-400">Référence</span><b>{recharge.rechargeId}</b></div>
          <div className="flex justify-between"><span className="text-gray-400">Compteur</span><b>{recharge.meterId}</b></div>
        </Card>

        <div className="mt-6 rounded-3xl bg-gradient-to-b from-wave-500 to-wave-600 p-6 text-center text-white">
          <p className="text-sm font-medium">Scannez le QR code avec votre application Wave</p>
          <div className="mt-4 mx-auto w-52">
            <QrPlaceholder seed={recharge.transactionId} className="w-52 h-52 mx-auto shadow-xl" />
          </div>
          <p className="text-[10px] text-purple-100 mt-3">QR simulé — PoC (aucune intégration Wave réelle)</p>
        </div>

        <div className="mt-6 space-y-3">
          <Button variant="wave" className="w-full" onClick={() => pay(true)}>Valider la transaction (simulé)</Button>
          <Button variant="secondary" className="w-full" onClick={() => pay(false)}>Simuler un échec de paiement</Button>
          <button onClick={() => navigate('/app')} className="w-full text-center text-sm text-gray-400 py-2">Annuler</button>
        </div>
      </div>
    </div>
  )
}

export function PaymentConfirmed() {
  const navigate = useNavigate()
  const { recharge } = useRechargeStore()
  if (!recharge) { navigate('/app/recharge'); return null }
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageHeader title="Paiement confirmé" onBack={() => navigate('/app')} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <span className="animate-pop w-24 h-24 rounded-full bg-cie-500 text-white text-5xl flex items-center justify-center shadow-lg shadow-cie-500/30">✓</span>
        <h2 className="text-xl font-bold mt-6">Paiement réussi</h2>
        <p className="text-2xl font-extrabold text-gray-900 mt-1">{fmtFcfa(recharge.amount)}</p>
        <div className="mt-8 w-full max-w-xs text-sm space-y-2">
          <div className="flex justify-between"><span className="text-gray-400">Référence</span><b>{recharge.rechargeId}</b></div>
          <div className="flex justify-between"><span className="text-gray-400">Transaction ID</span><b>{recharge.transactionId}</b></div>
        </div>
      </div>
      <div className="p-6">
        <Button className="w-full" onClick={() => navigate('/app/recharge/statut')}>Continuer</Button>
      </div>
    </div>
  )
}

const STEPS = [
  { key: 'payment', label: 'Paiement', sub: 'Confirmé', loader: 'Confirmation du paiement...' },
  { key: 'recharge', label: 'Recharge', sub: 'Créée', loader: 'Création de la recharge...' },
  { key: 'token', label: 'Token', sub: 'Généré', loader: 'Génération de votre recharge...' },
  { key: 'command', label: 'Commande', sub: 'Envoyée au compteur', loader: 'Transmission au compteur...' },
  { key: 'ack', label: 'Compteur', sub: 'ACK reçu', loader: 'Confirmation du compteur...' },
  { key: 'credit', label: 'Crédit appliqué', sub: 'Succès', loader: 'Application du crédit...' },
]

export function RechargeStatus() {
  const navigate = useNavigate()
  const { recharge, outcome } = useRechargeStore()
  const notify = useAppStore((s) => s.notify)
  const pushAlert = useAppStore((s) => s.pushAlert)
  const [step, setStep] = useState(outcome === 'payment_failed' ? -1 : 0)

  const failAt = outcome === 'injection_failed' ? 4 : 99
  const done = step >= STEPS.length
  const failed = outcome === 'injection_failed' && step >= failAt

  useEffect(() => {
    if (!recharge || outcome === 'payment_failed' || done || failed) return
    if (step === 3) mqttMock.simulateCommandFlow(recharge.meterId, recharge.commandId, outcome === 'success')
    const t = setTimeout(() => setStep((s) => s + 1), 1500)
    return () => clearTimeout(t)
  }, [step, done, failed, recharge, outcome])

  useEffect(() => {
    if (done && recharge) {
      notify('Recharge réussie !', `${fmtFcfa(recharge.amount)} — crédit mis à jour sur ${recharge.meterId}`, 'SUCCESS')
      pushAlert({
        alertId: `AL-${Date.now()}`, meterId: recharge.meterId, type: 'RECHARGE_SUCCESS', severity: 'SUCCESS',
        message: `Recharge de ${fmtFcfa(recharge.amount)} appliquée avec succès`, createdAt: new Date().toISOString(), read: false,
      })
    }
    if (failed && recharge) {
      notify('Injection échouée', 'Le token est disponible pour saisie manuelle.', 'WARNING')
    }
  }, [done, failed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!recharge) { navigate('/app/recharge'); return null }

  if (outcome === 'payment_failed') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <PageHeader title="Statut de la recharge" onBack={() => navigate('/app')} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <span className="animate-pop w-24 h-24 rounded-full bg-red-500 text-white text-5xl flex items-center justify-center">✕</span>
          <h2 className="text-xl font-bold mt-6">Paiement échoué</h2>
          <p className="text-sm text-gray-500 mt-2">La transaction {recharge.transactionId} n’a pas pu être validée. Aucun montant n’a été débité (simulation).</p>
        </div>
        <div className="p-6 space-y-3">
          <Button className="w-full" onClick={() => navigate('/app/recharge')}>Réessayer</Button>
          <Button variant="secondary" className="w-full" onClick={() => navigate('/app')}>Retour à l’accueil</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <PageHeader title="Statut de la recharge" onBack={() => navigate('/app')} />
      <div className="px-6 py-6">
        <div className="space-y-0">
          {STEPS.map((s, i) => {
            const isDone = i < step || done
            const isCurrent = i === step && !done
            const isFailed = failed && i === failAt
            const hidden = failed && i > failAt
            if (hidden) return null
            return (
              <div key={s.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isFailed ? 'bg-red-500 text-white' : isDone ? 'bg-cie-500 text-white' : isCurrent ? 'bg-white border-2 border-cie-500' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isFailed ? '✕' : isDone ? '✓' : isCurrent ? <Spinner className="!w-4 !h-4 !border-2" /> : i + 1}
                  </span>
                  {i < STEPS.length - 1 && !(failed && i >= failAt) && <span className={`w-0.5 flex-1 min-h-6 ${isDone ? 'bg-cie-500' : 'bg-gray-200'}`} />}
                </div>
                <div className="pb-6">
                  <p className={`text-sm font-semibold ${isFailed ? 'text-red-600' : 'text-gray-900'}`}>{s.label}</p>
                  <p className="text-xs text-gray-400">{isFailed ? 'Échec d’injection automatique' : isCurrent ? s.loader : isDone ? s.sub : 'En attente...'}</p>
                </div>
              </div>
            )
          })}
        </div>

        {done && (
          <div className="animate-slide-up mt-2 space-y-3">
            <div className="rounded-2xl bg-cie-600 text-white p-4 flex items-center gap-3">
              <span className="text-2xl">🔋</span>
              <div>
                <p className="font-bold">Recharge réussie !</p>
                <p className="text-xs text-cie-100">Votre crédit a été mis à jour.</p>
              </div>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => navigate(`/app/tokens/${recharge.tokenId}`)}>Voir le détail du token</Button>
            <Button className="w-full" onClick={() => navigate('/app')}>Terminer</Button>
          </div>
        )}

        {failed && (
          <div className="animate-slide-up mt-2 space-y-3">
            <Button className="w-full" onClick={() => navigate('/app/recharge/fallback')}>Saisir le token manuellement</Button>
            <Button variant="secondary" className="w-full" onClick={() => navigate('/app')}>Plus tard</Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function TokenDetailPage() {
  const navigate = useNavigate()
  const { tokenId } = useParams()
  const { recharge } = useRechargeStore()
  const notify = useAppStore((s) => s.notify)

  const data = useMemo(() => {
    if (recharge && recharge.tokenId === tokenId) {
      return {
        tokenId: recharge.tokenId, meterId: recharge.meterId, amount: recharge.amount,
        energyValue: recharge.energyValue, status: 'CREDIT_APPLIED', transactionId: recharge.transactionId,
        createdAt: new Date().toISOString(), tokenValue: recharge.tokenValue,
      }
    }
    return null
  }, [recharge, tokenId])

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <PageHeader title="Détail du token" onBack={() => navigate(-1)} />
      <div className="px-5 py-5">
        <Card className="p-5">
          <p className="font-extrabold text-lg text-center">TOKEN #{tokenId}</p>
          <div className="mt-5 text-sm space-y-2.5">
            <div className="flex justify-between"><span className="text-gray-400">Compteur</span><b>{data?.meterId ?? 'MTR-458921'}</b></div>
            <div className="flex justify-between"><span className="text-gray-400">Montant</span><b>{fmtFcfa(data?.amount ?? 5000)}</b></div>
            <div className="flex justify-between"><span className="text-gray-400">Énergie</span><b>{(data?.energyValue ?? 10.9).toFixed(1)} kWh</b></div>
            <div className="flex justify-between"><span className="text-gray-400">Statut</span><span className="text-cie-700 font-bold text-xs bg-cie-50 rounded px-2 py-0.5">CREDIT_APPLIED</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Date</span><b>{new Date(data?.createdAt ?? Date.now()).toLocaleString('fr-FR')}</b></div>
            <div className="flex justify-between"><span className="text-gray-400">Transaction</span><b>{data?.transactionId ?? '—'}</b></div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" className="flex-1" onClick={() => { navigator.clipboard?.writeText(data?.tokenValue ?? ''); notify('Copié', 'Token copié dans le presse-papiers', 'INFO') }}>📋 Copier le token</Button>
            <Button variant="secondary" className="flex-1" onClick={() => notify('Partage simulé', 'Fonction de partage (MOCK)', 'INFO')}>↗ Partager</Button>
          </div>
        </Card>
        <button onClick={() => navigate('/app/tokens')} className="w-full text-center text-sm text-cie-600 font-semibold mt-5">Voir tous mes tokens</button>
      </div>
    </div>
  )
}

export function TokenFallback() {
  const navigate = useNavigate()
  const { recharge } = useRechargeStore()
  const token = recharge?.tokenValue ?? '1326 9458 7764 2217'
  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <PageHeader title="Fallback – Token manuel" onBack={() => navigate('/app')} />
      <div className="px-5 py-5 space-y-4">
        <Card className="p-5 bg-orange-50 border-orange-200 text-center">
          <span className="text-3xl">⚠️</span>
          <p className="font-bold text-gray-900 mt-2">Injection automatique échouée</p>
          <p className="text-xs text-gray-500 mt-1">Veuillez entrer le token ci-dessous sur votre compteur</p>
          <p className="text-2xl font-extrabold text-red-600 tracking-wider mt-4">{token}</p>
        </Card>
        <Card className="p-4 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Compteur</span><b>{recharge?.meterId ?? 'MTR-458921'}</b></div>
        </Card>
        <Card className="p-4 text-sm text-gray-600 space-y-1.5">
          <p>1. Appuyez sur le bouton <b>ENTER</b> de votre compteur</p>
          <p>2. Saisissez le token ci-dessus</p>
          <p>3. Validez</p>
        </Card>
        <Button variant="secondary" className="w-full">Voir comment faire</Button>
        <Button className="w-full" onClick={() => navigate('/app')}>J’ai compris</Button>
      </div>
    </div>
  )
}
