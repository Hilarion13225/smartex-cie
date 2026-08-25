// Adaptateur HTTP réel — appelle le backend Spring Boot (backend/poc-backend).
// Voir docs/05_reconciliation-api-frontend-backend.md pour la justification de chaque
// mapping (chemin, champs) et api.ts pour la liste des endpoints sans équivalent backend
// (ceux-là restent servis par des données mock même dans cet adaptateur, avec un
// commentaire à chaque endroit — pas d'invention de comportement backend côté frontend).

import type { Customer, Meter, AuditEvent, RechargeDetail, MeterStatusResponse } from '../types'
import type { ApiAdapter } from './api'
import { http } from './httpClient'
import {
  mockMeters, mockTokens, mockTransactions, mockAlerts,
  mockIncidents, mockUsers, mockDevices, mockServices, mockConsumption,
} from '../mocks/data'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Backend CustomerResponse : customerId, phoneNumber, displayName, role, phoneVerified,
// createdAt — pas de firstName/lastName séparés, pas d'email, pas de meterId/contractId
// (aucune association Customer↔Meter n'existe encore côté backend, voir docs/05 §8 item 4).
// On mappe du mieux possible vers le type frontend Customer sans inventer les champs
// manquants (chaînes vides plutôt que valeurs plausibles mais fausses).
export type BackendRole = 'CLIENT' | 'CIE_OPERATOR' | 'CIE_ADMIN' | 'DSI_ADMIN'

interface BackendCustomer {
  customerId: string
  phoneNumber: string
  displayName: string
  role: BackendRole
  phoneVerified: boolean
  createdAt: string
}

// Le rôle backend est réel et utile (ex: navigation post-login) même si le type frontend
// partagé `Customer` (mock-first) ne le déclare pas — étendu ici plutôt que dans types/
// pour ne pas faire croire que MockApiAdapter le fournit aussi.
export type RealCustomer = Customer & { role: BackendRole }

function mapCustomer(c: BackendCustomer): RealCustomer {
  const [firstName, ...rest] = c.displayName.split(' ')
  return {
    customerId: c.customerId,
    firstName: firstName || c.displayName,
    lastName: rest.join(' '),
    phone: c.phoneNumber,
    email: '',
    meterId: '',
    contractId: '',
    createdAt: c.createdAt,
    role: c.role,
  }
}

export class RealApiAdapter implements ApiAdapter {
  async login(phone: string) {
    return http.post<{ otpSent: boolean }>('/api/v1/auth/login', { phoneNumber: phone }, false)
  }

  async register(data: Partial<Customer> & { password: string }) {
    // email/meterId/contractId collectés par le formulaire mais NON envoyés : le backend
    // ne les persiste pas (Customer n'a que phoneNumber/displayName/password/role, voir
    // customer.domain.Customer) — les inventer côté payload serait silencieusement ignoré
    // par le backend, donc autant ne pas prétendre les envoyer. Signalé dans le rapport de
    // connexion frontend/backend, pas un oubli.
    const displayName = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Client'
    // Normalisation des espaces indispensable : verify-otp est ensuite appelé avec le
    // même numéro "nettoyé" (voir pages/auth.tsx) — un mismatch d'espaces ferait échouer
    // la vérification OTP alors que le compte existe bien.
    return http.post<{ otpSent: boolean }>('/api/v1/auth/register', {
      phoneNumber: (data.phone ?? '').replace(/\s/g, ''),
      displayName,
      password: data.password,
    }, false)
  }

  async verifyOtp(phone: string, code: string) {
    const result = await http.post<{ verified: boolean; customer: BackendCustomer; token: string }>(
      '/api/v1/auth/verify-otp', { phoneNumber: phone, code }, false,
    )
    return { verified: result.verified, customer: mapCustomer(result.customer), token: result.token }
  }

  async getMe() {
    const c = await http.get<BackendCustomer>('/api/v1/customers/me')
    return mapCustomer(c)
  }

  async getMeter(meterId: string): Promise<Meter> {
    const s = await http.get<MeterStatusResponse>(`/api/v1/meters/${meterId}/status`, false)
    return {
      meterId: s.meterId,
      customerId: '',
      deviceId: s.deviceId,
      status: s.onlineStatus ? 'ONLINE' : 'OFFLINE', // backend n'a pas WARNING/MAINTENANCE
      creditFcfa: s.creditUnit === 'FCFA' || s.creditUnit === 'XOF' ? s.creditBalance : 0,
      creditKwh: 0,
      // Champs sans équivalent backend (ALG-01 non implémenté, voir docs/05 §3) : valeurs
      // neutres explicites plutôt qu'inventées. Signalé au produit, pas décidé ici.
      creditPercent: 0,
      creditStatus: 'NORMAL',
      autonomyDays: 0,
      lastHeartbeat: s.lastSeen ?? '',
      voltage: 0,
      current: 0,
      consumptionTodayKwh: 0,
      location: '',
      alertCount: 0,
    }
  }

  // Pas d'équivalent backend (GET /api/v1/cie/meters n'existe pas) — reste mock.
  async listMeters() { await delay(300); return mockMeters }
  // Pas d'équivalent backend — reste mock.
  async getConsumption(period: string) { await delay(300); return mockConsumption[period] ?? mockConsumption.semaine }
  // Pas d'équivalent backend (pas de liste par client) — reste mock.
  async listTransactions() { await delay(300); return mockTransactions }
  async getTransaction(id: string) { await delay(200); return mockTransactions.find((t) => t.transactionId === id) }

  async getRecharge(id: string): Promise<RechargeDetail> {
    return http.get<RechargeDetail>(`/api/v1/recharges/${id}`)
  }

  // Pas d'équivalent backend (le token n'est jamais exposé en clair) — reste mock.
  async listTokens() { await delay(300); return mockTokens }
  async getToken(id: string) { await delay(200); return mockTokens.find((t) => t.tokenId === id) }
  // Pas d'équivalent backend — reste mock.
  async listAlerts() { await delay(300); return mockAlerts }
  async listIncidents() { await delay(300); return mockIncidents }

  async listAuditEvents(correlationId?: string): Promise<AuditEvent[]> {
    if (!correlationId) return []
    const events = await http.get<Array<{
      auditId: string; correlationId: string; actor: string; action: string
      entityType: string | null; entityId: string | null; result: string | null
      errorCode: string | null; details: string | null; timestamp: string
    }>>(`/api/v1/audit?correlationId=${encodeURIComponent(correlationId)}`)
    return events.map((e) => ({
      eventId: e.auditId,
      actor: e.actor,
      action: e.action,
      resource: [e.entityType, e.entityId].filter(Boolean).join(':'),
      timestamp: e.timestamp,
      correlationId: e.correlationId,
      status: e.result ?? '',
      errorCode: e.errorCode,
    }))
  }

  // Pas d'équivalent backend (GET /api/v1/dsi/users n'existe pas) — reste mock.
  async listUsers() { await delay(300); return mockUsers }
  // Pas d'équivalent backend — reste mock.
  async listDevices() { await delay(300); return mockDevices }
  // Pas d'équivalent backend — reste mock.
  async listServices() { await delay(300); return mockServices }
}
