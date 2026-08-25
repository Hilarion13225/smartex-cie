import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { AuditEvent, Device, DsiUser, ServiceHealth, Token } from '../types'
import { fmtFcfa } from '../types'
import { Badge, Card, KpiCard, MeterStatusBadge, RechargeStatusBadge, Skeleton } from '../components/ui'

export function AdminUsers() {
  const [users, setUsers] = useState<DsiUser[] | null>(null)
  useEffect(() => { api.listUsers().then(setUsers) }, [])
  const roleColor: Record<DsiUser['role'], string> = {
    CLIENT: 'blue', CIE_OPERATOR: 'green', CIE_ADMIN: 'purple', DSI_ADMIN: 'orange',
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Utilisateurs" value={(users?.length ?? 0).toString()} />
        <KpiCard label="Actifs" value={(users?.filter((u) => u.status === 'ACTIVE').length ?? 0).toString()} subColor="text-cie-600" />
        <KpiCard label="Suspendus" value={(users?.filter((u) => u.status === 'SUSPENDED').length ?? 0).toString()} subColor="text-red-500" />
        <KpiCard label="Rôles" value="4" sub="CLIENT · OPERATOR · CIE_ADMIN · DSI_ADMIN" />
      </div>
      <Card className="overflow-x-auto">
        {!users ? <Skeleton className="h-64 m-4" /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
                <th className="px-4 py-3">Utilisateur</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3"><p className="font-semibold">{u.name}</p><p className="text-[11px] text-gray-400">{u.userId}</p></td>
                  <td>{u.email}</td>
                  <td><Badge color={roleColor[u.role]}>{u.role}</Badge></td>
                  <td><Badge color={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.status}</Badge></td>
                  <td className="text-xs text-gray-500">{new Date(u.lastLogin).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card className="p-5">
        <p className="font-semibold text-sm mb-3">Matrice des rôles (RBAC)</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 text-left border-b border-gray-100">
              <th className="py-2">Permission</th><th>CLIENT</th><th>CIE_OPERATOR</th><th>CIE_ADMIN</th><th>DSI_ADMIN</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Recharger son compteur', '✓', '—', '—', '—'],
              ['Voir son historique / tokens', '✓', '—', '—', '—'],
              ['Superviser le parc', '—', '✓', '✓', '✓'],
              ['Gérer incidents', '—', '✓', '✓', '—'],
              ['Gérer utilisateurs & rôles', '—', '—', '✓', '✓'],
              ['Devices & credentials', '—', '—', '—', '✓'],
              ['Audit & monitoring', '—', '—', '✓', '✓'],
            ].map((row) => (
              <tr key={row[0]} className="border-b border-gray-50">
                {row.map((c, i) => <td key={i} className={`py-2 ${i === 0 ? 'text-gray-600' : c === '✓' ? 'text-cie-600 font-bold' : 'text-gray-300'}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

export function AdminDevices() {
  const [devices, setDevices] = useState<Device[] | null>(null)
  useEffect(() => { api.listDevices().then(setDevices) }, [])
  const credColor: Record<Device['credentialStatus'], string> = { VALID: 'green', EXPIRING: 'orange', REVOKED: 'red' }
  return (
    <Card className="overflow-x-auto">
      {!devices ? <Skeleton className="h-64 m-4" /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
              <th className="px-4 py-3">Dongle</th><th>Compteur</th><th>Firmware</th><th>Statut</th><th>Credential mTLS</th><th>Vu pour la dernière fois</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.deviceId} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold">{d.deviceId}</td>
                <td>{d.meterId}</td>
                <td className="font-mono text-xs">{d.firmware}</td>
                <td><MeterStatusBadge status={d.status} /></td>
                <td><Badge color={credColor[d.credentialStatus]}>{d.credentialStatus}</Badge></td>
                <td className="text-xs text-gray-500">{new Date(d.lastSeen).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

export function AdminTokens() {
  const [tokens, setTokens] = useState<Token[] | null>(null)
  useEffect(() => { api.listTokens().then(setTokens) }, [])
  return (
    <Card className="overflow-x-auto">
      {!tokens ? <Skeleton className="h-64 m-4" /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
              <th className="px-4 py-3">Token</th><th>Compteur</th><th>Montant</th><th>Statut</th><th>Transaction</th><th>Valeur (masquée)</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.tokenId} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-cie-700">{t.tokenId}</td>
                <td>{t.meterId}</td>
                <td className="font-semibold">{fmtFcfa(t.amount)}</td>
                <td><RechargeStatusBadge status={t.status} /></td>
                <td className="text-xs">{t.transactionId}</td>
                <td className="font-mono text-xs text-gray-400">•••• •••• •••• ••••</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

export function AdminAudit() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  useEffect(() => { api.listAuditEvents().then(setEvents) }, [])
  const statusColor = (s: string) => (s === 'FAILED' || s === 'REJECTED' ? 'red' : s === 'ACCEPTED' ? 'blue' : 'green')
  return (
    <Card className="p-5">
      <p className="font-semibold text-sm mb-1">Timeline d’audit (append-only)</p>
      <p className="text-xs text-gray-400 mb-4">Chaque événement est corrélé par correlationId : paiement → token → commande → ACK → crédit.</p>
      {!events ? <Skeleton className="h-64" /> : (
        <ol className="relative border-l border-gray-200 ml-2 space-y-5">
          {events.map((e) => (
            <li key={e.eventId} className="ml-5">
              <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-cie-500" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm">{e.action}</span>
                <Badge color={statusColor(e.status)}>{e.status}</Badge>
                <span className="text-[11px] text-gray-400">{new Date(e.timestamp).toLocaleString('fr-FR')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                acteur : <b>{e.actor}</b> · ressource : <b>{e.resource}</b> · <span className="font-mono">{e.correlationId}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

export function AdminServices() {
  const [services, setServices] = useState<ServiceHealth[] | null>(null)
  useEffect(() => { api.listServices().then(setServices) }, [])
  const color: Record<ServiceHealth['status'], string> = { UP: 'green', DEGRADED: 'orange', DOWN: 'red' }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Services UP" value={(services?.filter((s) => s.status === 'UP').length ?? 0).toString()} subColor="text-cie-600" />
        <KpiCard label="Dégradés" value={(services?.filter((s) => s.status === 'DEGRADED').length ?? 0).toString()} subColor="text-orange-500" />
        <KpiCard label="Down" value={(services?.filter((s) => s.status === 'DOWN').length ?? 0).toString()} subColor="text-red-500" />
        <KpiCard label="Latence moyenne" value={services ? `${Math.round(services.reduce((a, s) => a + s.latencyMs, 0) / services.length)} ms` : '—'} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(services ?? []).map((s) => (
          <Card key={s.name} className="p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm font-mono">{s.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Latence {s.latencyMs} ms · Uptime {s.uptimePercent}%</p>
            </div>
            <Badge color={color[s.status]}>{s.status}</Badge>
          </Card>
        ))}
        {!services && <Skeleton className="h-40 rounded-2xl" />}
      </div>
      <p className="text-[10px] text-gray-400">Monitoring simulé (MOCK). En production : métriques payments_total, commands_total, activations_success_total, activation_latency_ms.</p>
    </div>
  )
}
