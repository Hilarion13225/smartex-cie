import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, createSimulatedRecharge, DEFAULT_METER_ID, useMock } from '../../services/api'
import type { RechargeDetail } from '../../types'
import { useAppStore } from '../../stores/app'
import { useRechargeStore } from '../../stores/recharge'
import type { PaymentProvider } from '../../types'
import { fmtFcfa, fcfaToKwh, MOCK_TARIFF_FCFA_PER_KWH } from '../../types'
import { Button, Card, FullScreenLoader, PageHeader, QrPlaceholder, Spinner } from '../../components/ui'

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000, 25000]

const operatorLogos: Record<string, string> = {
  WAVE: '/logos/wave-logo.jpg',
  ORANGE_MONEY: '/logos/orangemoney-logo.jpg',
  MTN_MONEY: '/logos/mtn-logo.jpg',
  MOOV_MONEY: '/logos/moov-logo.jpg',
}

export function RechargeAmount() {
  const navigate = useNavigate()
  const { amount, setAmount } = useRechargeStore()
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const effective = custom ? parseInt(custom) || 0 : amount

  const handleContinue = () => {
    if (effective < 500) return
    setLoading(true)
    setTimeout(() => {
      if (custom) setAmount(effective)
      navigate('/app/recharge/moyen')
    }, 300)
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PageHeader title="Montant" onBack={() => navigate(-1)} />

      <div className="flex-1 px-5 py-4 space-y-4">
        {/* Montant sélectionné - EN PREMIER */}
        <div className="bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-2xl p-6 text-center">
          <p className="text-sm opacity-90">Montant à recharger</p>
          <p className="text-5xl font-extrabold mt-2">{fmtFcfa(effective)}</p>
          <p className="text-sm opacity-90 mt-2">≈ {fcfaToKwh(effective).toFixed(1)} kWh</p>
        </div>

        {/* Montants rapides */}
        <div>
          <p className="text-xs text-gray-600 font-bold mb-2">RAPIDES</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => { setAmount(a); setCustom('') }}
                disabled={loading}
                className={`py-2 px-3 text-sm font-bold rounded-lg border-2 transition ${!custom && amount === a ? 'bg-cie-600 text-white border-cie-600' : 'bg-white border-gray-300 text-gray-900'} ${loading ? 'opacity-50' : ''}`}
              >
                {(a/1000).toFixed(0)}k
              </button>
            ))}
          </div>
        </div>

        {/* Montant custom */}
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
          placeholder="Montant personnalisé"
          inputMode="numeric"
          disabled={loading}
          className="w-full py-3 px-4 text-lg font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cie-500 disabled:opacity-50"
        />
      </div>

      {/* BOUTON EN AVANT - GRAND ET VISIBLE */}
      <div className={`px-5 py-4 bg-white border-t-4 transition-all duration-300 ${effective >= 500 ? 'border-cie-600 shadow-lg shadow-cie-600/30 animate-pop' : 'border-gray-200'}`}>
        <Button
          variant={effective >= 500 ? "confirm" : "primary"}
          disabled={effective < 500 || loading}
          onClick={handleContinue}
          className={`w-full py-4 text-lg font-bold transition-all duration-300 ${effective >= 500 ? 'scale-100 shadow-lg' : 'scale-95 opacity-60'}`}
        >
          {loading ? '⏳ Chargement...' : `Confirmer ${fmtFcfa(effective)}`}
        </Button>
      </div>
    </div>
  )
}

const PROVIDERS: { id: PaymentProvider; name: string; sub: string; logo: string }[] = [
  { id: 'WAVE', name: 'Wave', sub: 'Payer avec Wave', logo: '/logos/wave-logo.jpg' },
  { id: 'ORANGE_MONEY', name: 'Orange Money', sub: 'Payer avec Orange Money', logo: '/logos/orangemoney-logo.jpg' },
  { id: 'MTN_MONEY', name: 'MTN Money', sub: 'Payer avec MTN Money', logo: '/logos/mtn-logo.jpg' },
  { id: 'MOOV_MONEY', name: 'Moov Money', sub: 'Payer avec Moov Money', logo: '/logos/moov-logo.jpg' },
]

export function RechargeMethod() {
  const navigate = useNavigate()
  const { provider, setProvider, amount, setRecharge, setOutcome } = useRechargeStore()
  const customer = useAppStore((s) => s.customer)
  const [loading, setLoading] = useState(false)

  const start = () => {
    if (!provider) return
    setLoading(true)
    setTimeout(() => {
      // Placeholder local uniquement (référence/QR affichés pendant la simulation de
      // paiement ci-après) -- la vraie recharge n'est créée côté backend qu'une fois le
      // paiement confirmé (voir WavePayment.pay), pas ici : "Tester l'échec" ne doit
      // jamais laisser une recharge orpheline côté serveur.
      const r = createSimulatedRecharge(amount, provider, customer?.meterId || DEFAULT_METER_ID)
      setRecharge(r)
      setOutcome('success')
      navigate('/app/recharge/paiement')
    }, 800)
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PageHeader title="Moyen de paiement" onBack={() => navigate(-1)} />

      <div className="flex-1 px-5 py-4 space-y-3">
        {/* Montant affiché */}
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-600">Montant à payer</p>
          <p className="text-3xl font-extrabold text-green-700">{fmtFcfa(amount)}</p>
        </div>

        {/* Opérateurs */}
        <div className="space-y-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              disabled={loading}
              className={`w-full flex items-center gap-3 rounded-lg border-2 p-3 bg-white text-left transition ${provider === p.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <img src={p.logo} alt={p.name} className="w-10 h-10 object-contain" />
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-gray-900 text-sm">{p.name}</span>
              </span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${provider === p.id ? 'border-orange-500 bg-orange-500' : 'border-gray-300'}`}>
                {provider === p.id && <span className="text-white text-xs">✓</span>}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* BOUTON EN AVANT - GRAND ET VISIBLE */}
      <div className="px-5 py-4 bg-white border-t-4 border-orange-400">
        <Button
          variant="confirm"
          onClick={start}
          disabled={loading || !provider}
          className="w-full py-4 text-lg font-bold"
        >
          {loading ? '⏳ Connexion...' : `Confirmer avec ${provider || 'un moyen'}`}
        </Button>
      </div>
    </div>
  )
}

export function WavePayment() {
  const navigate = useNavigate()
  const { recharge, setRecharge, setOutcome, amount } = useRechargeStore()
  const customer = useAppStore((s) => s.customer)
  const addTransaction = useAppStore((s) => s.addTransaction)
  const notify = useAppStore((s) => s.notify)
  const setLastPaymentAmount = useAppStore((s) => s.setLastPaymentAmount)
  const [phase, setPhase] = useState<'connect' | 'qr' | 'confirming'>('connect')

  useEffect(() => {
    const t = setTimeout(() => setPhase('qr'), 1600)
    return () => clearTimeout(t)
  }, [])

  if (!recharge) { navigate('/app/recharge'); return null }

  const pay = (ok: boolean) => {
    setPhase('confirming')
    setTimeout(async () => {
      if (!ok) {
        addTransaction({
          amount: recharge.amount,
          provider: recharge.provider,
          status: 'failed',
          meterId: recharge.meterId,
        })
        notify('Paiement échoué', 'Veuillez réessayer', 'WARNING')
        navigate('/app/recharge/error')
        return
      }
      // Mode mock uniquement : MockApiAdapter.listTransactions() renvoie un jeu de demo
      // statique qui ne verra jamais cette recharge, le store local est donc la seule trace
      // qu'elle affichera. En mode reel, createRecharge() ci-dessous cree la vraie recharge
      // cote backend, deja recuperee par listTransactions() -- l'ajouter aussi ici faisait
      // doublon dans l'historique (une entree locale "TXN-..." a la date invalide en plus
      // de la vraie), pour chaque recharge reussie, sans exception.
      if (useMock) {
        addTransaction({
          amount: recharge.amount,
          provider: recharge.provider,
          status: 'success',
          meterId: recharge.meterId,
        })
      }
      try {
        // Paiement (simulé) confirmé -> la recharge n'est créée pour de vrai côté backend
        // qu'à partir de maintenant (voir RechargeMethod.start, qui ne posait qu'un
        // placeholder local pour l'affichage pendant cette étape) : "Tester l'échec"
        // ci-dessus ne doit jamais laisser une recharge orpheline côté serveur.
        const real = await api.createRecharge(recharge.amount, recharge.provider, recharge.meterId)
        setRecharge(real)
        setLastPaymentAmount(real.amount)
        navigate(`/app/recharge/progress?operator=${real.provider}&amount=${real.amount}`)
      } catch {
        notify(
          'Recharge impossible',
          'Le paiement a été confirmé mais la recharge n’a pas pu être envoyée au serveur — contactez le support.',
          'CRITICAL',
        )
        navigate('/app')
      }
    }, 2200)
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {phase === 'connect' && <FullScreenLoader wave title="Connexion..." subtitle="Simulation Wave" />}

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 text-center gap-6">
        {/* Logo opérateur */}
        <img
          src={operatorLogos[recharge.provider] || '/logos/wave-logo.jpg'}
          alt={recharge.provider}
          className="h-20 w-20 object-contain"
        />

        {/* Opérateur et montant */}
        <div>
          <p className="text-xs text-gray-500">Paiement via {recharge.provider.replace('_', ' ')}</p>
          <p className="text-4xl font-extrabold text-orange-700 mt-2">{fmtFcfa(recharge.amount)}</p>
          <p className="text-sm text-gray-500 mt-2">≈ {fcfaToKwh(recharge.amount).toFixed(1)} kWh</p>
        </div>

        {/* QR Code compact */}
        {phase === 'qr' && (
          <div className="bg-gradient-to-br from-orange-50 to-white p-4 rounded-2xl border-2 border-orange-200">
            <div className="w-40 h-40">
              <QrPlaceholder seed={recharge.transactionId} className="w-40 h-40" />
            </div>
          </div>
        )}

        {/* Détails transaction */}
        <div className="w-full bg-gray-50 rounded-xl p-4 text-left text-sm">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-gray-600"><span>Référence</span><span className="font-mono text-gray-900">{recharge.rechargeId}</span></div>
            <div className="flex justify-between text-gray-600"><span>Compteur</span><span className="font-mono text-gray-900">{recharge.meterId}</span></div>
          </div>
        </div>
      </div>

      {/* Sticky buttons */}
      <div className="bg-gradient-to-t from-white via-white to-white/80 p-5 border-t border-gray-100 space-y-3">
        <Button
          onClick={() => pay(true)}
          disabled={phase === 'confirming'}
          className="w-full py-4 text-lg font-bold"
        >
          {phase === 'confirming' ? '⏳ Traitement...' : '✓ Confirmer le paiement'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => pay(false)}
          disabled={phase === 'confirming'}
          className="w-full text-sm"
        >
          Tester l'échec
        </Button>
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

// backend RechargeStatus (ci.cie.smartprepaid.recharge.domain.RechargeStatus) -> index dans
// STEPS ci-dessus. COMMAND_TIMEOUT reste affiché comme "commande envoyée" (un retry est en
// cours côté CommandExpiryWatcher, voir README §Résilience) plutôt que régresser l'affichage.
const STATUS_TO_STEP: Record<string, number> = {
  CREATED: 1, TOKEN_GENERATED: 2, COMMAND_SENT: 3, COMMAND_TIMEOUT: 3,
  COMMAND_REJECTED: 4, FALLBACK_TOKEN_SENT: 4, CREDIT_APPLIED: 5,
}
const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 20 // ~30s avant d'afficher "toujours en cours"

export function RechargeStatus() {
  const navigate = useNavigate()
  const { recharge, outcome } = useRechargeStore()
  const notify = useAppStore((s) => s.notify)
  const [detail, setDetail] = useState<RechargeDetail | null>(null)
  const [stillWaiting, setStillWaiting] = useState(false)

  // Interroge le vrai statut backend (voir api.getRecharge) au lieu d'une animation locale
  // programmée à l'avance : avant feature/telemetry-alg01, cet écran ne faisait qu'avancer
  // une barre de progression sur un minuteur, sans jamais vérifier ce qui s'était réellement
  // passé côté serveur.
  useEffect(() => {
    if (!recharge || outcome === 'payment_failed') return
    let cancelled = false
    let attempts = 0

    const poll = async () => {
      try {
        const d = await api.getRecharge(recharge.rechargeId)
        if (cancelled) return
        setDetail(d)
        const terminal = d.finalStatus === 'CREDIT_APPLIED' || d.finalStatus === 'COMMAND_REJECTED'
          || d.finalStatus === 'FALLBACK_TOKEN_SENT'
        attempts += 1
        if (terminal) return
        if (attempts >= MAX_POLL_ATTEMPTS) { setStillWaiting(true); return }
        setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        if (!cancelled) setStillWaiting(true)
      }
    }
    poll()
    return () => { cancelled = true }
  }, [recharge, outcome])

  const status = detail?.finalStatus
  const done = status === 'CREDIT_APPLIED'
  const failed = status === 'COMMAND_REJECTED' || status === 'FALLBACK_TOKEN_SENT'
  const step = done ? STEPS.length : status ? (STATUS_TO_STEP[status] ?? 1) : 0
  const failAt = 4

  useEffect(() => {
    // notify() enregistre aussi l'alerte automatiquement (voir stores/app.ts) -- plus
    // besoin d'un pushAlert séparé ici, type/meterId passés explicitement.
    if (done && recharge) {
      notify(
        'Recharge réussie !', `${fmtFcfa(recharge.amount)} — crédit mis à jour sur ${recharge.meterId}`,
        'SUCCESS', 'RECHARGE_SUCCESS', recharge.meterId,
      )
    }
    if (failed && recharge) {
      notify(
        status === 'FALLBACK_TOKEN_SENT' ? 'Injection échouée' : 'Recharge refusée',
        status === 'FALLBACK_TOKEN_SENT'
          ? 'Le compteur n’a pas confirmé automatiquement.' : 'Le compteur a rejeté la commande.',
        'WARNING',
        status === 'FALLBACK_TOKEN_SENT' ? 'INJECTION_FAILED' : 'COMMAND_REJECTED',
        recharge.meterId,
      )
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
            {recharge.tokenValue && (
              <Button variant="secondary" className="w-full" onClick={() => navigate(`/app/tokens/${recharge.tokenId}`)}>Voir le détail du token</Button>
            )}
            <Button className="w-full" onClick={() => navigate('/app')}>Terminer</Button>
          </div>
        )}

        {failed && (
          <div className="animate-slide-up mt-2 space-y-3">
            <Button className="w-full" onClick={() => navigate('/app/recharge/fallback')}>Saisir le token manuellement</Button>
            <Button variant="secondary" className="w-full" onClick={() => navigate('/app')}>Plus tard</Button>
          </div>
        )}

        {stillWaiting && !done && !failed && (
          <div className="animate-slide-up mt-2 rounded-xl bg-orange-50 border border-orange-200 p-4 text-sm text-orange-800">
            Toujours en cours de traitement côté serveur — revenez sur cet écran dans
            quelques instants (référence : <span className="font-mono">{recharge.rechargeId}</span>).
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
          {data?.tokenValue ? (
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => { navigator.clipboard?.writeText(data.tokenValue); notify('Copié', 'Token copié dans le presse-papiers', 'INFO') }}>📋 Copier le token</Button>
            </div>
          ) : (
            <p className="mt-6 text-xs text-gray-400 text-center">
              Le token a été transmis automatiquement à votre compteur — il n'est jamais affiché en clair, pour votre sécurité.
            </p>
          )}
        </Card>
        <button onClick={() => navigate('/app/tokens')} className="w-full text-center text-sm text-cie-600 font-semibold mt-5">Voir tous mes tokens</button>
      </div>
    </div>
  )
}

export function TokenFallback() {
  const navigate = useNavigate()
  const { recharge } = useRechargeStore()
  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <PageHeader title="Fallback – Token manuel" onBack={() => navigate('/app')} />
      <div className="px-5 py-5 space-y-4">
        <Card className="p-5 bg-orange-50 border-orange-200 text-center">
          <span className="text-3xl">⚠️</span>
          <p className="font-bold text-gray-900 mt-2">Injection automatique échouée</p>
          {recharge?.tokenValue ? (
            <>
              <p className="text-xs text-gray-500 mt-1">Veuillez entrer le token ci-dessous sur votre compteur</p>
              <p className="text-2xl font-extrabold text-red-600 tracking-wider mt-4">{recharge.tokenValue}</p>
            </>
          ) : (
            <p className="text-xs text-gray-500 mt-2">
              Pour votre sécurité, le token n'est pas affiché dans l'application. Contactez le
              support avec la référence <span className="font-mono">{recharge?.rechargeId ?? '—'}</span> pour
              l'obtenir.
            </p>
          )}
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
