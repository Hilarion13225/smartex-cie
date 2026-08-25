// Couche API contract-first.
// Les composants n'appellent JAMAIS les mocks directement : ils passent par ces services.
// MockApiAdapter (actuel) sera remplacé par QuarkusApiAdapter sans toucher aux pages.

import type {
  Customer, Meter, Token, Transaction, Alert, Incident, AuditEvent,
  DsiUser, Device, ServiceHealth, ConsumptionPoint, PaymentProvider, RechargeStatus,
} from '../types'
import {
  mockCustomers, mockMeters, mockTokens, mockTransactions, mockAlerts,
  mockIncidents, mockAuditEvents, mockUsers, mockDevices, mockServices, mockConsumption,
} from '../mocks/data'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface ApiAdapter {
  // POST /api/v1/auth/login
  login(phone: string, password: string): Promise<Customer>
  // POST /api/v1/auth/register
  register(data: Partial<Customer> & { password: string }): Promise<{ otpSent: boolean }>
  // POST /api/v1/auth/verify-otp
  verifyOtp(code: string): Promise<{ verified: boolean; customer: Customer }>
  // GET /api/v1/customers/me
  getMe(): Promise<Customer>
  // GET /api/v1/meters/{meterId}
  getMeter(meterId: string): Promise<Meter>
  // GET /api/v1/cie/meters
  listMeters(): Promise<Meter[]>
  // GET /api/v1/consumption?period=
  getConsumption(period: string): Promise<ConsumptionPoint[]>
  // GET /api/v1/recharges/history
  listTransactions(): Promise<Transaction[]>
  // GET /api/v1/payments/{id}
  getTransaction(id: string): Promise<Transaction | undefined>
  // GET /api/v1/tokens
  listTokens(): Promise<Token[]>
  // GET /api/v1/tokens/{id}
  getToken(id: string): Promise<Token | undefined>
  // GET /api/v1/alerts
  listAlerts(): Promise<Alert[]>
  // GET /api/v1/cie/incidents
  listIncidents(): Promise<Incident[]>
  // GET /api/v1/dsi/audit
  listAuditEvents(): Promise<AuditEvent[]>
  // GET /api/v1/dsi/users
  listUsers(): Promise<DsiUser[]>
  // GET /api/v1/dsi/devices
  listDevices(): Promise<Device[]>
  // GET /api/v1/dsi/services
  listServices(): Promise<ServiceHealth[]>
}

class MockApiAdapter implements ApiAdapter {
  async login(_phone: string, _password: string) {
    await delay(1400)
    return mockCustomers[0]
  }
  async register(_data: Partial<Customer> & { password: string }) {
    await delay(1200)
    return { otpSent: true }
  }
  async verifyOtp(code: string) {
    await delay(1000)
    if (code.length !== 6) throw new Error('Code invalide')
    return { verified: true, customer: mockCustomers[0] }
  }
  async getMe() { await delay(300); return mockCustomers[0] }
  async getMeter(meterId: string) {
    await delay(600)
    const m = mockMeters.find((x) => x.meterId === meterId)
    if (!m) throw new Error('Compteur introuvable')
    return m
  }
  async listMeters() { await delay(700); return mockMeters }
  async getConsumption(period: string) { await delay(650); return mockConsumption[period] ?? mockConsumption.semaine }
  async listTransactions() { await delay(600); return mockTransactions }
  async getTransaction(id: string) { await delay(400); return mockTransactions.find((t) => t.transactionId === id) }
  async listTokens() { await delay(550); return mockTokens }
  async getToken(id: string) { await delay(400); return mockTokens.find((t) => t.tokenId === id) }
  async listAlerts() { await delay(500); return mockAlerts }
  async listIncidents() { await delay(600); return mockIncidents }
  async listAuditEvents() { await delay(550); return mockAuditEvents }
  async listUsers() { await delay(500); return mockUsers }
  async listDevices() { await delay(550); return mockDevices }
  async listServices() { await delay(450); return mockServices }
}

export const api: ApiAdapter = new MockApiAdapter()

// ─── Orchestration de recharge simulée (POST /api/v1/recharges) ───
// Reproduit la chaîne : paiement → token → commande MQTT → ACK → crédit appliqué.

export interface RechargeStep {
  status: RechargeStatus
  label: string
  detail: string
}

export const RECHARGE_STEPS: RechargeStep[] = [
  { status: 'PAYMENT_CONFIRMED', label: 'Paiement', detail: 'Confirmé' },
  { status: 'CREATED', label: 'Recharge', detail: 'Créée' },
  { status: 'TOKEN_GENERATED', label: 'Token', detail: 'Généré' },
  { status: 'COMMAND_SENT', label: 'Commande', detail: 'Envoyée au compteur' },
  { status: 'CREDIT_APPLIED', label: 'Compteur', detail: 'ACK reçu — crédit appliqué' },
]

export interface SimulatedRecharge {
  rechargeId: string
  transactionId: string
  tokenId: string
  commandId: string
  correlationId: string
  amount: number
  energyValue: number
  provider: PaymentProvider
  meterId: string
  tokenValue: string
}

let seq = 184
export function createSimulatedRecharge(amount: number, provider: PaymentProvider, meterId: string): SimulatedRecharge {
  seq += 1
  const n = seq.toString().padStart(6, '0')
  return {
    rechargeId: `RCG-2026-${n}`,
    transactionId: `TX-89342${(19832 + seq).toString().slice(-4)}`,
    tokenId: `TK-2026-${n}`,
    commandId: `CMD-${(219832 + seq).toString()}`,
    correlationId: `CORR-${(829173 + seq).toString()}`,
    amount,
    energyValue: +(amount / 458.7).toFixed(1),
    provider,
    meterId,
    tokenValue: `${1000 + (seq * 7) % 9000} ${2000 + (seq * 13) % 8000} ${3000 + (seq * 21) % 7000} ${1111 + (seq * 3) % 8888}`,
  }
}
