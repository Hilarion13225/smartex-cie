import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { ApiError } from '../services/httpClient'
import { useAdminAlerts } from '../hooks/useAdminAlerts'
import type { AuditEvent, Device, DsiUser, MeterRegistryEntry, RechargeDetail, ServiceHealth, Token } from '../types'
import { fmtFcfa } from '../types'
import { Badge, Button, Card, KpiCard, MeterStatusBadge, RechargeStatusBadge, SeverityDot, Skeleton } from '../components/ui'

const ROLES: DsiUser['role'][] = ['CLIENT', 'CIE_OPERATOR', 'CIE_ADMIN', 'DSI_ADMIN']

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback
}

// Détail + actions d'un compte sélectionné (module de gestion admin, voir
// CustomerController côté backend : changement de rôle, suspension, association
// compteur). Réservé CIE_ADMIN/DSI_ADMIN comme le reste de cet écran.
function UserDetailPanel({ user, onChanged, onClose }: { user: DsiUser; onChanged: (u: DsiUser) => void; onClose: () => void }) {
  const [role, setRole] = useState(user.role)
  const [meterId, setMeterId] = useState(user.meterId)
  const [contractId, setContractId] = useState(user.contractId)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (key: string, action: () => Promise<DsiUser>) => {
    setBusy(key)
    setError(null)
    try {
      onChanged(await action())
    } catch (err) {
      setError(errorMessage(err, 'Action impossible'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-5 space-y-4 border-2 border-cie-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-400">{user.userId} · {user.phone}{user.email && ` · ${user.email}`}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Rôle</p>
          <div className="flex gap-2">
            <select value={role} onChange={(e) => setRole(e.target.value as DsiUser['role'])}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <Button onClick={() => run('role', () => api.changeUserRole(user.userId, role))}
                    disabled={busy !== null || role === user.role}>
              {busy === 'role' ? '...' : 'Changer'}
            </Button>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Statut du compte</p>
          {user.status === 'ACTIVE' ? (
            <Button variant="secondary" onClick={() => run('suspend', () => api.suspendUser(user.userId))} disabled={busy !== null}>
              {busy === 'suspend' ? '...' : '⏸ Suspendre'}
            </Button>
          ) : (
            <Button onClick={() => run('reactivate', () => api.reactivateUser(user.userId))} disabled={busy !== null}>
              {busy === 'reactivate' ? '...' : '▶ Réactiver'}
            </Button>
          )}
        </div>

        <div className="sm:col-span-2">
          <p className="text-xs text-gray-500 mb-1">Compteur associé</p>
          {user.meterId && (
            <p className="text-xs text-gray-400 mb-2">
              Actuellement : <span className="font-mono font-semibold text-gray-700">{user.meterId}</span>
              {user.contractId && <> · contrat {user.contractId}</>}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={meterId} onChange={(e) => setMeterId(e.target.value)} placeholder="Numéro de compteur"
                   className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cie-500" />
            <input value={contractId} onChange={(e) => setContractId(e.target.value)} placeholder="Numéro de contrat (optionnel)"
                   className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500" />
            <Button onClick={() => run('assign', () => api.assignUserMeter(user.userId, meterId.trim(), contractId.trim() || undefined))}
                    disabled={busy !== null || !meterId.trim()}>
              {busy === 'assign' ? '...' : 'Assigner'}
            </Button>
            {user.meterId && (
              <Button variant="secondary" onClick={() => run('unassign', () => api.unassignUserMeter(user.userId))} disabled={busy !== null}>
                {busy === 'unassign' ? '...' : 'Retirer'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function CreateOperatorForm({ onCreated }: { onCreated: () => void }) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<DsiUser['role']>('CIE_OPERATOR')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (!phone.trim() || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await api.createOperator(phone.trim(), name.trim(), role, email.trim() || undefined)
      setPhone(''); setName(''); setEmail('')
      onCreated()
    } catch (err) {
      setError(errorMessage(err, 'Création impossible'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5">
      <p className="font-semibold text-sm mb-1">Créer un compte opérateur / admin</p>
      <p className="text-xs text-gray-400 mb-4">
        Contrairement à l'auto-inscription (toujours CLIENT), crée directement un compte
        avec le rôle choisi — il se connecte ensuite normalement (téléphone + OTP).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Numéro de téléphone"
               className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet"
               className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optionnel)"
               className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500" />
        <select value={role} onChange={(e) => setRole(e.target.value as DsiUser['role'])}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500">
          {ROLES.filter((r) => r !== 'CLIENT').map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <Button onClick={create} disabled={saving || !phone.trim() || !name.trim()}>
        {saving ? 'Création...' : 'Créer le compte'}
      </Button>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3 mt-3">{error}</div>}
    </Card>
  )
}

export function AdminUsers() {
  const [users, setUsers] = useState<DsiUser[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const load = () => api.listUsers().then(setUsers)
  useEffect(() => { load() }, [])

  const roleColor: Record<DsiUser['role'], string> = {
    CLIENT: 'blue', CIE_OPERATOR: 'green', CIE_ADMIN: 'purple', DSI_ADMIN: 'orange',
  }
  const selected = users?.find((u) => u.userId === selectedId) ?? null

  const applyChange = (updated: DsiUser) => {
    setUsers((prev) => prev?.map((u) => (u.userId === updated.userId ? updated : u)) ?? prev)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Utilisateurs" value={(users?.length ?? 0).toString()} />
        <KpiCard label="Actifs" value={(users?.filter((u) => u.status === 'ACTIVE').length ?? 0).toString()} subColor="text-cie-600" />
        <KpiCard label="Suspendus" value={(users?.filter((u) => u.status === 'SUSPENDED').length ?? 0).toString()} subColor="text-red-500" />
        <KpiCard label="Rôles" value="4" sub="CLIENT · OPERATOR · CIE_ADMIN · DSI_ADMIN" />
      </div>

      <CreateOperatorForm onCreated={load} />

      {selected && (
        <UserDetailPanel
          user={selected}
          onChanged={applyChange}
          onClose={() => setSelectedId(null)}
        />
      )}

      <Card className="overflow-x-auto">
        {!users ? <Skeleton className="h-64 m-4" /> : (
          <table className="w-full min-w-180 text-sm">
            <thead>
              <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
                <th className="px-4 py-3">Utilisateur</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Compteur</th><th>Dernière connexion</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId}
                    onClick={() => setSelectedId(u.userId === selectedId ? null : u.userId)}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer ${u.userId === selectedId ? 'bg-cie-50/60' : ''}`}>
                  <td className="px-4 py-3"><p className="font-semibold">{u.name}</p><p className="text-[11px] text-gray-400 whitespace-nowrap">{u.userId} · {u.phone}</p></td>
                  <td className="whitespace-nowrap">{u.email || '—'}</td>
                  <td><Badge color={roleColor[u.role]}>{u.role}</Badge></td>
                  <td><Badge color={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.status}</Badge></td>
                  <td className="font-mono text-xs whitespace-nowrap">{u.meterId || '—'}</td>
                  <td className="text-xs text-gray-500 whitespace-nowrap">{u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card className="p-5 overflow-x-auto">
        <p className="font-semibold text-sm mb-3">Matrice des rôles (RBAC)</p>
        <table className="w-full min-w-130 text-xs">
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

// Registre des compteurs connus de la CIE (voir meter.domain.Meter côté backend) --
// distinct de AdminDevices (les dongles) : un compteur peut être enregistré ici avant
// même qu'un dongle y soit installé (rollout réel typique). Base de la validation
// Client<->Compteur à l'inscription (voir AuthService.register).
export function AdminMeters() {
  const [meters, setMeters] = useState<MeterRegistryEntry[] | null>(null)
  const [meterId, setMeterId] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => api.listMeterRegistry().then(setMeters).catch(() => setMeters([]))
  useEffect(() => { load() }, [])

  const register = async () => {
    if (!meterId.trim()) return
    setSaving(true)
    setError(null)
    try {
      await api.registerMeter(meterId.trim(), label.trim() || undefined)
      setMeterId('')
      setLabel('')
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="font-semibold text-sm mb-1">Enregistrer un compteur</p>
        <p className="text-xs text-gray-400 mb-4">
          Un client ne peut associer son compte qu'à un compteur déjà présent dans cette liste
          (voir AuthService.register côté backend) — l'enregistrer ici ne suppose pas qu'un
          dongle y soit déjà installé.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={meterId}
            onChange={(e) => setMeterId(e.target.value)}
            placeholder="Numéro de compteur (ex: 58901234567)"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cie-500"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Libellé (optionnel)"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500"
          />
          <Button onClick={register} disabled={saving || !meterId.trim()}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3 mt-3">{error}</div>}
      </Card>

      <Card className="overflow-x-auto">
        {!meters ? <Skeleton className="h-64 m-4" /> : (
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
                <th className="px-4 py-3">Compteur</th><th>Libellé</th><th>Dongle installé</th>
                <th>Client associé</th><th>Enregistré le</th>
              </tr>
            </thead>
            <tbody>
              {meters.map((m) => (
                <tr key={m.meterId} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-semibold font-mono whitespace-nowrap">{m.meterId}</td>
                  <td className="whitespace-nowrap">{m.label ?? '—'}</td>
                  <td><Badge color={m.hasDevice ? 'green' : 'orange'}>{m.hasDevice ? 'Oui' : 'Non'}</Badge></td>
                  <td className="font-mono text-xs whitespace-nowrap">{m.claimedByCustomerId ?? '—'}</td>
                  <td className="text-xs text-gray-500 whitespace-nowrap">{new Date(m.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
              {meters.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Aucun compteur enregistré.</td></tr>
              )}
            </tbody>
          </table>
        )}
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
        <table className="w-full min-w-180 text-sm">
          <thead>
            <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
              <th className="px-4 py-3">Dongle</th><th>Compteur</th><th>Firmware</th><th>Statut</th><th>Credential mTLS</th><th>Vu pour la dernière fois</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.deviceId} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold whitespace-nowrap">{d.deviceId}</td>
                <td className="whitespace-nowrap">{d.meterId}</td>
                <td className="font-mono text-xs whitespace-nowrap">{d.firmware}</td>
                <td><MeterStatusBadge status={d.status} /></td>
                <td><Badge color={credColor[d.credentialStatus]}>{d.credentialStatus}</Badge></td>
                <td className="text-xs text-gray-500 whitespace-nowrap">{new Date(d.lastSeen).toLocaleString('fr-FR')}</td>
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
        <table className="w-full min-w-180 text-sm">
          <thead>
            <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
              <th className="px-4 py-3">Token</th><th>Compteur</th><th>Montant</th><th>Statut</th><th>Transaction</th><th>Valeur (masquée)</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.tokenId} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-cie-700 whitespace-nowrap">{t.tokenId}</td>
                <td className="whitespace-nowrap">{t.meterId}</td>
                <td className="font-semibold whitespace-nowrap">{fmtFcfa(t.amount)}</td>
                <td><RechargeStatusBadge status={t.status} /></td>
                <td className="text-xs whitespace-nowrap">{t.transactionId}</td>
                <td className="font-mono text-xs text-gray-400 whitespace-nowrap">•••• •••• •••• ••••</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// Le backend n'expose aucune liste d'audit non filtrée (GET /api/v1/audit exige
// correlationId, voir AuditController) — cette page cherche donc par correlationId au
// lieu d'afficher une timeline globale (contrairement à l'ancien mock). Réservé
// CIE_OPERATOR/CIE_ADMIN/DSI_ADMIN côté backend (SecurityConfig) : un CLIENT connecté
// reçoit un 403, affiché ici proprement plutôt que de laisser la page en squelette
// infini (voir docs/05_reconciliation-api-frontend-backend.md §4).
export function AdminAudit() {
  const [correlationId, setCorrelationId] = useState('')
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    if (!correlationId.trim()) return
    setLoading(true)
    setError(null)
    try {
      setEvents(await api.listAuditEvents(correlationId.trim()))
    } catch (err) {
      setEvents(null)
      if (err instanceof ApiError && err.status === 403) {
        setError('Accès refusé — cette vue est réservée aux rôles CIE_OPERATOR / CIE_ADMIN / DSI_ADMIN. Reconnectez-vous avec un compte opérateur.')
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Session expirée — reconnectez-vous.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Recherche impossible')
      }
    } finally {
      setLoading(false)
    }
  }

  const statusColor = (s: string) => (s === 'FAILED' || s === 'REJECTED' ? 'red' : s === 'ACCEPTED' ? 'blue' : 'green')
  return (
    <Card className="p-5">
      <p className="font-semibold text-sm mb-1">Timeline d’audit (append-only)</p>
      <p className="text-xs text-gray-400 mb-4">Chaque événement est corrélé par correlationId : paiement → token → commande → ACK → crédit.</p>
      <div className="flex gap-2 mb-4">
        <input
          value={correlationId}
          onChange={(e) => setCorrelationId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="correlationId (voir en-tête X-Correlation-Id ou GET /recharges/{id})"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500"
        />
        <Button onClick={search} disabled={loading || !correlationId.trim()}>Rechercher</Button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3 mb-4">{error}</div>
      )}
      {loading && <Skeleton className="h-64" />}
      {!loading && !error && events && events.length === 0 && (
        <p className="text-sm text-gray-400">Aucun événement pour ce correlationId.</p>
      )}
      {!loading && events && events.length > 0 && (
        <ol className="relative border-l border-gray-200 ml-2 space-y-5">
          {events.map((e) => (
            <li key={e.eventId} className="ml-5">
              <span className="absolute -left-1.25 mt-1.5 w-2.5 h-2.5 rounded-full bg-cie-500" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm">{e.action}</span>
                <Badge color={statusColor(e.status)}>{e.status}</Badge>
                <span className="text-[11px] text-gray-400">{new Date(e.timestamp).toLocaleString('fr-FR')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                acteur : <b>{e.actor}</b> · ressource : <b>{e.resource}</b> · <span className="font-mono">{e.correlationId}</span>
                {e.errorCode && <> · erreur : <b className="text-red-600">{e.errorCode}</b></>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

// Ajouté pour cette branche (pas d'équivalent avant) : recherche d'une recharge par id,
// via le vrai GET /api/v1/recharges/{id} (ownership : CLIENT limité à ses propres
// recharges, CIE_OPERATOR/CIE_ADMIN/DSI_ADMIN voient tout — voir RechargeAuthorization).
export function AdminRechargeLookup() {
  const [rechargeId, setRechargeId] = useState('')
  const [recharge, setRecharge] = useState<RechargeDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    if (!rechargeId.trim()) return
    setLoading(true)
    setError(null)
    setRecharge(null)
    try {
      setRecharge(await api.getRecharge(rechargeId.trim()))
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Accès refusé — cette recharge n’appartient pas à votre compte.')
      } else if (err instanceof ApiError && err.status === 404) {
        setError('Recharge introuvable.')
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Session expirée — reconnectez-vous.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Recherche impossible')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5">
      <p className="font-semibold text-sm mb-1">Recherche recharge</p>
      <p className="text-xs text-gray-400 mb-4">GET /api/v1/recharges/{'{id}'} — statut réel, paiement, commandes.</p>
      <div className="flex gap-2 mb-4">
        <input
          value={rechargeId}
          onChange={(e) => setRechargeId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="rechargeId (UUID)"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cie-500"
        />
        <Button onClick={search} disabled={loading || !rechargeId.trim()}>Rechercher</Button>
      </div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}
      {loading && <Skeleton className="h-32" />}
      {!loading && recharge && (
        <div className="text-sm space-y-2">
          <div className="flex justify-between"><span className="text-gray-400">Statut final</span><Badge color={recharge.finalStatus === 'CREDIT_APPLIED' ? 'green' : recharge.finalStatus.includes('REJECTED') ? 'red' : 'orange'}>{recharge.finalStatus}</Badge></div>
          <div className="flex justify-between"><span className="text-gray-400">Statut paiement</span><b>{recharge.paymentStatus ?? '—'}</b></div>
          <div className="flex justify-between"><span className="text-gray-400">Compteur</span><b>{recharge.meterId}</b></div>
          <div className="flex justify-between"><span className="text-gray-400">Montant</span><b>{fmtFcfa(recharge.amountXof)}</b></div>
          <div className="flex justify-between"><span className="text-gray-400">Corrélation</span><span className="font-mono text-xs">{recharge.correlationId}</span></div>
          {recharge.commands.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Commandes ({recharge.commands.length})</p>
              {recharge.commands.map((c) => (
                <div key={c.commandId} className="flex justify-between text-xs py-1">
                  <span className="font-mono">{c.commandId.slice(0, 8)}…</span>
                  <Badge color={c.status === 'ACCEPTED' ? 'green' : c.status === 'REJECTED' ? 'red' : 'orange'}>{c.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
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

// Alertes admin/CIE (cloche de PortalLayout) : entièrement dérivées de données réelles déjà
// exposées (voir useAdminAlerts) -- pas de "lu/non lu" ni de suppression, l'état est
// recalculé en direct à chaque rafraîchissement, pas une liste persistée.
export function AdminAlertsPage() {
  const alerts = useAdminAlerts()
  const typeLabel: Record<string, string> = {
    LOW_CREDIT: 'Compteur en crédit faible',
    DEVICE_OFFLINE: 'Device hors-ligne',
    ACCOUNT_SUSPENDED: 'Compte suspendu',
    NEW_REGISTRATION: 'Nouvelle inscription',
  }
  return (
    <div className="space-y-2.5">
      <p className="text-xs text-gray-400 mb-2">
        Dérivé en direct du parc de compteurs, des devices et des comptes — pas une liste
        persistée, recalculée à chaque rafraîchissement (voir useAdminAlerts).
      </p>
      {alerts.length === 0 && (
        <Card className="p-6 text-center text-sm text-gray-400">Aucune alerte pour le moment.</Card>
      )}
      {alerts.map((a) => (
        <Card key={a.alertId} className="p-4 flex items-start gap-3">
          <SeverityDot severity={a.severity} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{typeLabel[a.type] ?? a.type}</p>
            <p className="text-xs text-gray-500 mt-0.5">{a.message}</p>
            <p className="text-[10px] text-gray-400 mt-1">{new Date(a.createdAt).toLocaleString('fr-FR')}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}
