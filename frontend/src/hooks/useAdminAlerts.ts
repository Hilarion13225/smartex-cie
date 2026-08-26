import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Alert } from '../types'

const NEW_REGISTRATION_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Alertes admin/CIE (cloche de PortalLayout) : entièrement dérivées de données déjà réelles
 * (aucun mécanisme de notification serveur->client dans ce PoC, pas de table dédiée côté
 * backend) -- jamais une valeur inventée, seulement une lecture de l'état actuel :
 * - compteurs du parc dont l'autonomie ALG-01 n'est plus NORMAL (GET /api/v1/meters) ;
 * - devices qui ne sont pas ONLINE (GET /api/v1/devices) ;
 * - comptes suspendus, et comptes créés dans les dernières 24h (GET /api/v1/customers) --
 *   ce dernier n'a pas de mécanisme "vu/pas vu", juste une fenêtre de temps glissante.
 * Chaque source est indépendante : GET /api/v1/customers est réservé CIE_ADMIN/DSI_ADMIN
 * (voir SecurityConfig), un CIE_OPERATOR sur /cie continue de voir les alertes
 * compteurs/devices même si celle-ci échoue en 403 (ignorée silencieusement, pas une
 * erreur à afficher -- juste une source non disponible pour ce rôle).
 */
export function useAdminAlerts(intervalMs = 20000): Alert[] {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      const [meters, devices, users] = await Promise.all([
        api.listMeters().catch(() => []),
        api.listDevices().catch(() => []),
        api.listUsers().catch(() => []),
      ])
      if (cancelled) return

      const result: Alert[] = []

      for (const m of meters) {
        if (m.creditStatus !== 'NORMAL') {
          const severity = m.creditStatus === 'CRITICAL' || m.creditStatus === 'CUT_RISK' ? 'CRITICAL' : 'WARNING'
          result.push({
            alertId: `METER-${m.meterId}`, meterId: m.meterId, type: 'LOW_CREDIT', severity,
            message: `${m.meterId} : autonomie estimée ${m.autonomyDays.toFixed(1)} jour(s) (${m.creditStatus})`,
            createdAt: new Date().toISOString(), read: false,
          })
        }
      }

      for (const d of devices) {
        if (d.status !== 'ONLINE') {
          result.push({
            alertId: `DEVICE-${d.deviceId}`, meterId: d.meterId, type: 'DEVICE_OFFLINE', severity: 'WARNING',
            message: `${d.deviceId} (${d.meterId}) : statut ${d.status}`,
            createdAt: d.lastSeen || new Date().toISOString(), read: false,
          })
        }
      }

      const now = Date.now()
      for (const u of users) {
        if (u.status === 'SUSPENDED') {
          result.push({
            alertId: `SUSPENDED-${u.userId}`, meterId: '', type: 'ACCOUNT_SUSPENDED', severity: 'WARNING',
            message: `Compte suspendu : ${u.name} (${u.phone})`,
            createdAt: new Date().toISOString(), read: false,
          })
        }
        if (u.role === 'CLIENT' && u.createdAt && now - new Date(u.createdAt).getTime() < NEW_REGISTRATION_WINDOW_MS) {
          result.push({
            alertId: `NEW-${u.userId}`, meterId: u.meterId, type: 'NEW_REGISTRATION', severity: 'INFO',
            message: `Nouvelle inscription : ${u.name} (${u.phone})`,
            createdAt: u.createdAt, read: false,
          })
        }
      }

      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setAlerts(result)
    }

    tick().finally(() => { if (!cancelled) timer = setInterval(tick, intervalMs) })

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [intervalMs])

  return alerts
}
