import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../services/api'
import { mockKpis, mockConsumption } from '../mocks/data'
import type { Incident, Meter, Transaction } from '../types'
import { fmtFcfa, fmtKwh } from '../types'
import {
  Badge, Card, CreditStatusBadge, KpiCard, MeterStatusBadge,
  RechargeStatusBadge, SeverityDot, Skeleton,
} from '../components/ui'

const providerLogo: Record<string, string> = {
  WAVE: '/logos/wave-logo.jpg',
  ORANGE_MONEY: '/logos/orangemoney-logo.jpg',
  MTN_MONEY: '/logos/mtn-logo.jpg',
  MOOV_MONEY: '/logos/moov-logo.jpg',
}

export function CieDashboard() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null)
  const [meters, setMeters] = useState<Meter[] | null>(null)
  useEffect(() => {
    api.listIncidents().then(setIncidents)
    api.listMeters().then(setMeters)
  }, [])

  const donut = [
    { name: 'En ligne', value: 87.6, color: '#16a34a' },
    { name: 'Offline', value: 12.4, color: '#ef4444' },
    { name: 'Maintenance', value: 2.1, color: '#f59e0b' },
  ]
  const rechargesDay = mockConsumption.jour.map((p, i) => ({ label: p.label, value: 200 + Math.round(p.kwh * 180) + i * 40 }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Parc total" value={mockKpis.parcTotal.toLocaleString('fr-FR')} sub="+2,5% vs hier" subColor="text-cie-600" />
        <KpiCard label="Compteurs en ligne" value={mockKpis.online.toLocaleString('fr-FR')} sub="87,6%" subColor="text-cie-600" />
        <KpiCard label="Compteurs offline" value={mockKpis.offline.toLocaleString('fr-FR')} sub="12,4%" subColor="text-red-500" />
        <KpiCard label="Alertes critiques" value={mockKpis.criticalAlerts.toString()} sub="+15 vs hier" subColor="text-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-5">
          <p className="text-xs text-gray-500">Recharges aujourd’hui</p>
          <p className="text-3xl font-extrabold mt-1">{mockKpis.rechargesToday.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-gray-400">Montant total : {fmtFcfa(mockKpis.rechargesAmountToday)}</p>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={rechargesDay}>
              <defs>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#0d9448" fill="url(#g2)" strokeWidth={2} name="Recharges" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-gray-500 mb-2">Répartition des compteurs</p>
          <div className="flex items-center">
            <div className="relative">
              <PieChart width={160} height={160}>
                <Pie data={donut} innerRadius={55} outerRadius={72} dataKey="value" strokeWidth={0}>
                  {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-extrabold">{mockKpis.parcTotal.toLocaleString('fr-FR')}</p>
                <p className="text-[10px] text-gray-400">Total</p>
              </div>
            </div>
            <div className="ml-6 space-y-2 text-xs">
              {donut.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-gray-600">{d.name}</span>
                  <span className="font-semibold ml-auto">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <p className="font-semibold text-sm">Incidents critiques</p>
            <Link to="/cie/incidents" className="text-xs text-cie-600 font-semibold whitespace-nowrap">Voir tous les incidents</Link>
          </div>
          {!incidents ? <Skeleton className="h-32" /> : (
            <div className="space-y-3">
              {incidents.slice(0, 3).map((i) => (
                <div key={i.incidentId} className="flex items-center gap-3 text-sm">
                  <SeverityDot severity={i.severity} />
                  <div className="flex-1">
                    <p className="font-medium">{i.type}</p>
                    <p className="text-[11px] text-gray-400">{i.meterId} · {i.location}</p>
                  </div>
                  <span className="text-[11px] text-gray-400">{new Date(i.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm">Derniers compteurs en alerte</p>
            <Link to="/cie/compteurs" className="text-xs text-cie-600 font-semibold">Voir tous les compteurs</Link>
          </div>
          {!meters ? <Skeleton className="h-32" /> : (
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 text-left"><th className="pb-2">Compteur</th><th>Type</th><th>Statut</th><th>Crédit</th></tr></thead>
              <tbody>
                {meters.filter((m) => m.alertCount > 0 || m.status !== 'ONLINE').slice(0, 4).map((m) => (
                  <tr key={m.meterId} className="border-t border-gray-50">
                    <td className="py-2"><Link to={`/cie/compteurs/${m.meterId}`} className="text-cie-700 font-semibold">{m.meterId}</Link></td>
                    <td><CreditStatusBadge status={m.creditStatus} /></td>
                    <td><MeterStatusBadge status={m.status} /></td>
                    <td className="font-semibold">{fmtFcfa(m.creditFcfa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}

export function CieMeters() {
  const [meters, setMeters] = useState<Meter[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => { api.listMeters().then(setMeters) }, [])
  const filtered = useMemo(() => (meters ?? []).filter((m) =>
    [m.meterId, m.customerId, m.location].join(' ').toLowerCase().includes(q.toLowerCase()),
  ), [meters, q])

  return (
    <div className="space-y-4">
      <input
        value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un compteur, un client, une localité..."
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500"
      />
      <Card className="overflow-x-auto">
        {!meters ? <Skeleton className="h-64 m-4" /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
                <th className="px-4 py-3">Compteur</th><th>Client</th><th>Statut</th><th>Crédit</th><th>Conso jour</th><th>Heartbeat</th><th>Alertes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.meterId} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3"><Link to={`/cie/compteurs/${m.meterId}`} className="text-cie-700 font-semibold">{m.meterId}</Link><p className="text-[11px] text-gray-400">{m.location}</p></td>
                  <td>{m.customerId}</td>
                  <td><MeterStatusBadge status={m.status} /></td>
                  <td className="font-semibold">{fmtFcfa(m.creditFcfa)}</td>
                  <td>{fmtKwh(m.consumptionTodayKwh)}</td>
                  <td className="text-xs text-gray-500">{new Date(m.lastHeartbeat).toLocaleTimeString('fr-FR')}</td>
                  <td>{m.alertCount > 0 ? <Badge color="red">{m.alertCount}</Badge> : <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

export function CieMeterDetail() {
  const { meterId } = useParams()
  const navigate = useNavigate()
  const [meter, setMeter] = useState<Meter | null>(null)
  const [txs, setTxs] = useState<Transaction[] | null>(null)
  useEffect(() => {
    api.getMeter(meterId ?? '').then(setMeter).catch(() => navigate('/cie/compteurs'))
    api.listTransactions().then(setTxs)
  }, [meterId, navigate])

  if (!meter) return <Skeleton className="h-96 rounded-2xl" />
  const meterTxs = (txs ?? []).filter((t) => t.meterId === meter.meterId)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white border border-gray-200">←</button>
        <h2 className="text-lg font-bold">{meter.meterId}</h2>
        <MeterStatusBadge status={meter.status} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Crédit" value={fmtFcfa(meter.creditFcfa)} sub={`≈ ${fmtKwh(meter.creditKwh)}`} />
        <KpiCard label="Conso aujourd’hui" value={fmtKwh(meter.consumptionTodayKwh)} />
        <KpiCard label="Tension" value={`${meter.voltage} V`} sub={`Courant : ${meter.current} A`} />
        <KpiCard label="Dernier heartbeat" value={new Date(meter.lastHeartbeat).toLocaleTimeString('fr-FR')} sub={new Date(meter.lastHeartbeat).toLocaleDateString('fr-FR')} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-5 text-sm space-y-2.5">
          <p className="font-semibold mb-2">Identité</p>
          <div className="flex justify-between"><span className="text-gray-400">Client</span><b>{meter.customerId}</b></div>
          <div className="flex justify-between"><span className="text-gray-400">Dongle / device</span><b>{meter.deviceId}</b></div>
          <div className="flex justify-between"><span className="text-gray-400">Localisation</span><b>{meter.location}</b></div>
          <div className="flex justify-between"><span className="text-gray-400">Statut crédit</span><CreditStatusBadge status={meter.creditStatus} /></div>
          <div className="flex justify-between"><span className="text-gray-400">Autonomie estimée</span><b>{meter.autonomyDays} jours</b></div>
        </Card>
        <Card className="p-5">
          <p className="font-semibold text-sm mb-3">Transactions du compteur</p>
          <div className="space-y-2 text-sm max-h-56 overflow-auto">
            {meterTxs.length === 0 && <p className="text-xs text-gray-400">Aucune transaction.</p>}
            {meterTxs.map((t) => (
              <div key={t.transactionId} className="flex items-center justify-between border-b border-gray-50 pb-2">
                <div>
                  <p className="font-semibold">{fmtFcfa(t.amount)}</p>
                  <p className="text-[11px] text-gray-400">{t.transactionId} · {new Date(t.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                <RechargeStatusBadge status={t.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

export function CieRecharges() {
  const [txs, setTxs] = useState<Transaction[] | null>(null)
  useEffect(() => { api.listTransactions().then(setTxs) }, [])
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Taux de succès paiement" value={`${mockKpis.paymentSuccessRate}%`} />
        <KpiCard label="Taux de succès recharge" value={`${mockKpis.rechargeSuccessRate}%`} />
        <KpiCard label="Temps moyen de recharge" value={`${mockKpis.avgRechargeTimeSec}s`} />
        <KpiCard label="Commandes échouées" value={mockKpis.failedCommands.toString()} subColor="text-red-500" sub="dernières 24h" />
      </div>
      <Card className="overflow-x-auto">
        {!txs ? <Skeleton className="h-64 m-4" /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
                <th className="px-4 py-3">Transaction</th><th>Compteur</th><th>Client</th><th>Fournisseur</th><th>Montant</th><th>Statut</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.transactionId} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-semibold text-cie-700">{t.transactionId}</td>
                  <td>{t.meterId}</td><td>{t.customerId}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <img src={providerLogo[t.provider] || '/logos/wave-logo.jpg'} alt={t.provider} className="w-6 h-6 object-contain" />
                      <span className="text-xs">{t.provider.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="font-semibold">{fmtFcfa(t.amount)}</td>
                  <td><RechargeStatusBadge status={t.status} /></td>
                  <td className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

export function CieIncidents() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null)
  useEffect(() => { api.listIncidents().then(setIncidents) }, [])
  return (
    <Card className="overflow-x-auto">
      {!incidents ? <Skeleton className="h-64 m-4" /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
              <th className="px-4 py-3">Incident</th><th>Type</th><th>Compteur</th><th>Client</th><th>Sévérité</th><th>Statut</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.incidentId} className="border-b border-gray-50">
                <td className="px-4 py-3 font-semibold">{i.incidentId}</td>
                <td>{i.type}</td><td>{i.meterId}</td><td>{i.customerName}</td>
                <td><span className="inline-flex items-center gap-1.5"><SeverityDot severity={i.severity} />{i.severity}</span></td>
                <td><Badge color={i.status === 'RESOLVED' ? 'green' : i.status === 'ACK' ? 'blue' : 'orange'}>{i.status}</Badge></td>
                <td className="text-xs text-gray-500">{new Date(i.createdAt).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

export function CieSimplePanel({ title, rows }: { title: string; rows: [string, string, string][] }) {
  return (
    <Card className="p-5">
      <p className="font-semibold text-sm mb-4">{title}</p>
      <div className="space-y-3">
        {rows.map(([label, value, color]) => (
          <div key={label} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
            <span className="text-gray-500">{label}</span>
            <span className={`font-semibold ${color}`}>{value}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-4">Données simulées (MOCK) — PoC</p>
    </Card>
  )
}

export function CieTelecom() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <CieSimplePanel title="Réseau & connectivité" rows={[
        ['Liaisons MQTT actives', '112 589', 'text-cie-600'],
        ['Latence moyenne broker', '84 ms', ''],
        ['Messages / min', '38 420', ''],
        ['Perte de paquets', '0,4%', 'text-orange-500'],
        ['Reconnexions (24h)', '1 204', ''],
      ]} />
      <CieSimplePanel title="Qualité de service" rows={[
        ['Disponibilité passerelle', '98,7%', 'text-orange-500'],
        ['Heartbeats manqués (24h)', '3 811', 'text-red-500'],
        ['Dongles à firmware obsolète', '2 148', 'text-orange-500'],
        ['Couverture GSM faible', '5 032 sites', ''],
      ]} />
    </div>
  )
}

export function CieFraude() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <CieSimplePanel title="Fraude / anomalies" rows={[
        ['Suspicions de bypass', '17', 'text-red-500'],
        ['Consommation sans crédit', '9', 'text-red-500'],
        ['Ouvertures capot détectées', '23', 'text-orange-500'],
        ['Anomalies de tension', '61', 'text-orange-500'],
        ['Dossiers en cours', '12', ''],
      ]} />
      <CieSimplePanel title="Cybersécurité" rows={[
        ['Tentatives auth. échouées (24h)', '482', 'text-orange-500'],
        ['Certificats device expirant < 30j', '318', 'text-orange-500'],
        ['ACL MQTT violations', '3', 'text-red-500'],
        ['Alertes SIEM ouvertes', '5', ''],
      ]} />
    </div>
  )
}

export function CieQualite() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <CieSimplePanel title="Qualité des données" rows={[
        ['Télémetries valides', '99,2%', 'text-cie-600'],
        ['Valeurs manquantes (24h)', '0,6%', ''],
        ['Doublons détectés', '0,1%', ''],
        ['Horodatages incohérents', '412', 'text-orange-500'],
      ]} />
      <CieSimplePanel title="Observabilité API" rows={[
        ['Disponibilité API', `${mockKpis.apiAvailability}%`, 'text-cie-600'],
        ['Erreurs 5xx (24h)', '112', 'text-orange-500'],
        ['P95 latence', '240 ms', ''],
        ['Alertes critiques', `${mockKpis.criticalAlerts}`, 'text-red-500'],
      ]} />
    </div>
  )
}

export function CieRapports() {
  const rows: [string, string][] = [
    ['Rapport journalier des recharges', '24/08/2026'],
    ['Rapport hebdomadaire du parc', 'Semaine 34'],
    ['Rapport incidents & fraude', 'Août 2026'],
    ['Export transactions (CSV)', '32 lignes'],
    ['Export compteurs (CSV)', '10 lignes'],
  ]
  return (
    <Card className="p-5">
      <p className="font-semibold text-sm mb-4">Rapports</p>
      <div className="space-y-2">
        {rows.map(([name, sub]) => (
          <div key={name} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3 text-sm">
            <div><p className="font-medium">{name}</p><p className="text-[11px] text-gray-400">{sub}</p></div>
            <button className="text-xs text-cie-600 font-semibold">Télécharger (simulé)</button>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function CieParametres() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <CieSimplePanel title="Seuils d’alerte" rows={[
        ['Crédit faible', '< 10 000 FCFA', ''],
        ['Crédit critique', '< 2 000 FCFA', ''],
        ['Surtension', '> 250 V', ''],
        ['Heartbeat manqué', '> 15 min', ''],
      ]} />
      <CieSimplePanel title="Tarification (simulation)" rows={[
        ['Tarif kWh (mock)', '458,7 F / kWh', ''],
        ['Frais de recharge', '0 F', ''],
        ['Montant min. recharge', '500 F', ''],
      ]} />
    </div>
  )
}
