import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api'
import { useAppStore } from '../../stores/app'
import type { Token, Transaction } from '../../types'
import { fmtFcfa } from '../../types'
import { Card, PageHeader, RechargeStatusBadge, Skeleton } from '../../components/ui'

const providerLabel: Record<string, string> = {
  WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', MTN_MONEY: 'MTN Money', MOOV_MONEY: 'Moov Money',
}

const providerLogo: Record<string, string> = {
  WAVE: '/logos/wave-logo.jpg',
  ORANGE_MONEY: '/logos/orangemoney-logo.jpg',
  MTN_MONEY: '/logos/mtn-logo.jpg',
  MOOV_MONEY: '/logos/moov-logo.jpg',
}

export function TransactionsPage() {
  const navigate = useNavigate()
  const [txs, setTxs] = useState<Transaction[] | null>(null)
  const [status, setStatus] = useState('TOUS')
  const [provider, setProvider] = useState('TOUS')
  const storeTransactions = useAppStore((s) => s.transactions)

  useEffect(() => {
    api.listTransactions().then((apiTxs) => {
      // Combine API transactions with store transactions (store first for recency)
      const combined = [
        ...storeTransactions.map((st) => ({
          transactionId: st.id,
          paymentId: `PAY-${st.id}`,
          rechargeId: `RCG-${st.id}`,
          tokenId: `TK-${st.id}`,
          amount: st.amount,
          energyValue: (st.amount / 1000) * 1.25,
          provider: st.provider,
          status: st.status === 'success' ? 'CREDIT_APPLIED' : 'PAYMENT_FAILED',
          meterId: st.meterId,
          customerId: '',
          correlationId: `CORR-${st.id}`,
          createdAt: st.date,
        } as Transaction)),
        ...apiTxs,
      ]
      setTxs(combined)
    })
  }, [storeTransactions])

  const filtered = useMemo(() => (txs ?? []).filter((t) =>
    (status === 'TOUS' || t.status === status) && (provider === 'TOUS' || t.provider === provider),
  ), [txs, status, provider])

  return (
    <div>
      <div className="px-5 pt-5"><h1 className="text-xl font-bold text-gray-900">Transactions</h1></div>
      <div className="px-5 mt-3 flex gap-2 overflow-x-auto pb-1">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5">
          <option value="TOUS">Statut : tous</option>
          <option value="CREDIT_APPLIED">CREDIT_APPLIED</option>
          <option value="PAYMENT_FAILED">PAYMENT_FAILED</option>
          <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
          <option value="TOKEN_GENERATED">TOKEN_GENERATED</option>
          <option value="COMMAND_REJECTED">COMMAND_REJECTED</option>
        </select>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5">
          <option value="TOUS">Fournisseur : tous</option>
          <option value="WAVE">Wave</option>
          <option value="ORANGE_MONEY">Orange Money</option>
          <option value="MTN_MONEY">MTN Money</option>
          <option value="MOOV_MONEY">Moov Money</option>
        </select>
      </div>
      <div className="px-5 mt-4 space-y-2.5">
        {!txs ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
        ) : filtered.map((t) => (
          <button key={t.transactionId} onClick={() => navigate(`/app/transactions/${t.transactionId}`)} className="w-full text-left">
            <Card className="p-4 flex items-center gap-3">
              <img src={providerLogo[t.provider] || '/logos/wave-logo.jpg'} alt={t.provider} className="w-10 h-10 rounded-xl object-contain" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-gray-900">{fmtFcfa(t.amount)} <span className="text-gray-400 font-normal">· {t.energyValue} kWh</span></span>
                <span className="block text-[11px] text-gray-400 truncate">{t.transactionId} · {new Date(t.createdAt).toLocaleDateString('fr-FR')} · {providerLabel[t.provider]}</span>
              </span>
              <RechargeStatusBadge status={t.status} />
            </Card>
          </button>
        ))}
      </div>
    </div>
  )
}

export function TransactionDetail() {
  const navigate = useNavigate()
  const { txId } = useParams()
  const [tx, setTx] = useState<Transaction | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getTransaction(txId ?? '').then((t) => { setTx(t); setLoading(false) })
  }, [txId])

  const chain = [
    { label: 'Paiement', sub: 'Confirmé', ok: tx && tx.status !== 'PAYMENT_FAILED' && tx.status !== 'PAYMENT_PENDING' },
    { label: 'Recharge', sub: 'Créée', ok: tx && tx.status !== 'PAYMENT_FAILED' && tx.status !== 'PAYMENT_PENDING' },
    { label: 'Token', sub: 'Généré', ok: tx && ['TOKEN_GENERATED', 'COMMAND_SENT', 'CREDIT_APPLIED', 'COMMAND_REJECTED'].includes(tx.status) },
    { label: 'Commande', sub: 'Envoyée', ok: tx && ['COMMAND_SENT', 'CREDIT_APPLIED', 'COMMAND_REJECTED'].includes(tx.status) },
    { label: 'Compteur', sub: 'Crédit appliqué', ok: tx?.status === 'CREDIT_APPLIED' },
  ]

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <PageHeader title={`Transaction ${txId}`} onBack={() => navigate(-1)} />
      <div className="px-5 py-5 space-y-4">
        {loading ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : !tx ? (
          <p className="text-sm text-gray-500 text-center py-10">Transaction introuvable.</p>
        ) : (
          <>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-extrabold">{fmtFcfa(tx.amount)}</p>
                <RechargeStatusBadge status={tx.status} />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Fournisseur</span><b>{providerLabel[tx.provider]}</b></div>
                <div className="flex justify-between"><span className="text-gray-400">Énergie</span><b>{tx.energyValue} kWh</b></div>
                <div className="flex justify-between"><span className="text-gray-400">Compteur</span><b>{tx.meterId}</b></div>
                <div className="flex justify-between"><span className="text-gray-400">Recharge ID</span><b>{tx.rechargeId}</b></div>
                <div className="flex justify-between"><span className="text-gray-400">Token ID</span><b>{tx.tokenId}</b></div>
                <div className="flex justify-between"><span className="text-gray-400">Correlation ID</span><b>{tx.correlationId}</b></div>
                <div className="flex justify-between"><span className="text-gray-400">Date</span><b>{new Date(tx.createdAt).toLocaleString('fr-FR')}</b></div>
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-semibold mb-4">Chaîne de traçabilité</p>
              {chain.map((c, i) => (
                <div key={c.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`w-6 h-6 rounded-full text-[11px] flex items-center justify-center font-bold ${c.ok ? 'bg-cie-500 text-white' : 'bg-gray-200 text-gray-400'}`}>{c.ok ? '✓' : '·'}</span>
                    {i < chain.length - 1 && <span className={`w-0.5 h-5 ${c.ok ? 'bg-cie-500' : 'bg-gray-200'}`} />}
                  </div>
                  <p className="text-sm -mt-0.5">{c.label} <span className="text-gray-400 text-xs">— {c.ok ? c.sub : 'non atteint'}</span></p>
                </div>
              ))}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

export function TokensPage() {
  const navigate = useNavigate()
  const [tokens, setTokens] = useState<Token[] | null>(null)
  const [reveal, setReveal] = useState<string | null>(null)

  useEffect(() => { api.listTokens().then(setTokens) }, [])

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <PageHeader title="Mes tokens" onBack={() => navigate(-1)} />
      <div className="px-5 py-4 space-y-2.5">
        {!tokens ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : tokens.slice(0, 15).map((t) => (
          <Card key={t.tokenId} className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">#{t.tokenId}</p>
              <RechargeStatusBadge status={t.status} />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{t.meterId} · {fmtFcfa(t.amount)} · {t.energyValue} kWh · {new Date(t.createdAt).toLocaleDateString('fr-FR')}</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="text-xs bg-gray-50 rounded px-2 py-1 tracking-wider">{reveal === t.tokenId ? t.tokenValue : '•••• •••• •••• ••••'}</code>
              <button className="text-xs text-cie-600 font-semibold" onClick={() => setReveal(reveal === t.tokenId ? null : t.tokenId)}>
                {reveal === t.tokenId ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </Card>
        ))}
        <p className="text-[10px] text-gray-400 text-center pt-2">Tokens simulés (MOCK) — les valeurs réelles ne sont jamais exposées côté client.</p>
      </div>
    </div>
  )
}
