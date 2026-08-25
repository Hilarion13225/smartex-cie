// Couche API contract-first.
// Les composants n'appellent JAMAIS les mocks directement : ils passent par ces services.
//
// Deux implémentations de ApiAdapter coexistent (voir docs/05_reconciliation-api-
// frontend-backend.md pour la justification endpoint par endpoint) :
// - MockApiAdapter : données simulées, aucun backend requis.
// - RealApiAdapter (services/realApi.ts) : vrais appels HTTP vers le backend Spring Boot.
// Bascule via VITE_USE_MOCK_API (voir .env.example).

import type {
  Customer, Meter, Token, Transaction, Alert, Incident, AuditEvent,
  DsiUser, Device, ServiceHealth, ConsumptionPoint, PaymentProvider, RechargeStatus,
  RechargeDetail,
} from '../types'
import {
  mockCustomers, mockMeters, mockTokens, mockTransactions, mockAlerts,
  mockIncidents, mockAuditEvents, mockUsers, mockDevices, mockServices, mockConsumption,
} from '../mocks/data'
import { RealApiAdapter } from './realApi'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface ApiAdapter {
  // POST /api/v1/auth/login — backend OTP-only (voir CustomerRole/AuthService) : pas de
  // mot de passe, ne fait que déclencher l'envoi d'un OTP. L'authentification effective
  // se fait dans verifyOtp. (Aligné sur le backend, pas l'inverse — décision déjà validée
  // pour ce domaine, voir docs/05 §8 / CLAUDE.md.)
  login(phone: string): Promise<{ otpSent: boolean }>
  // POST /api/v1/auth/register
  register(data: Partial<Customer> & { password: string }): Promise<{ otpSent: boolean }>
  // POST /api/v1/auth/verify-otp
  verifyOtp(phone: string, code: string): Promise<{ verified: boolean; customer: Customer; token: string }>
  // GET /api/v1/customers/me
  getMe(): Promise<Customer>
  // GET /api/v1/meters/{meterId}/status
  getMeter(meterId: string): Promise<Meter>
  // GET /api/v1/cie/meters — pas d'équivalent backend, reste mock (voir docs/05 §7)
  listMeters(): Promise<Meter[]>
  // GET /api/v1/consumption?period= — pas d'équivalent backend, reste mock
  getConsumption(period: string): Promise<ConsumptionPoint[]>
  // GET /api/v1/recharges/history — pas d'équivalent backend (seul le détail par id existe,
  // voir getRecharge ci-dessous), reste mock
  listTransactions(): Promise<Transaction[]>
  // GET /api/v1/payments/{id} — pas d'équivalent backend, reste mock
  getTransaction(id: string): Promise<Transaction | undefined>
  // GET /api/v1/recharges/{id} — endpoint réel, protégé (ownership : le CLIENT ne voit que
  // ses propres recharges, CIE_OPERATOR/CIE_ADMIN/DSI_ADMIN voient tout — voir SecurityConfig)
  getRecharge(id: string): Promise<RechargeDetail>
  // GET /api/v1/tokens — pas d'équivalent backend (le token n'est de toute façon jamais
  // exposé en clair, voir CLAUDE.md règle #3), reste mock
  listTokens(): Promise<Token[]>
  // GET /api/v1/tokens/{id} — idem
  getToken(id: string): Promise<Token | undefined>
  // GET /api/v1/alerts — pas d'équivalent backend, reste mock
  listAlerts(): Promise<Alert[]>
  // GET /api/v1/cie/incidents — pas d'équivalent backend, reste mock
  listIncidents(): Promise<Incident[]>
  // GET /api/v1/audit?correlationId= — endpoint réel, réservé CIE_OPERATOR/CIE_ADMIN/
  // DSI_ADMIN (403 sinon). Paramètre obligatoire côté backend (pas de liste non filtrée) :
  // voir AdminAudit pour la recherche par correlationId.
  listAuditEvents(correlationId?: string): Promise<AuditEvent[]>
  // GET /api/v1/dsi/users — pas d'équivalent backend, reste mock
  listUsers(): Promise<DsiUser[]>
  // GET /api/v1/dsi/devices — pas d'équivalent backend, reste mock
  listDevices(): Promise<Device[]>
  // GET /api/v1/dsi/services — pas d'équivalent backend, reste mock
  listServices(): Promise<ServiceHealth[]>
}

class MockApiAdapter implements ApiAdapter {
  async login(_phone: string) {
    await delay(1400)
    return { otpSent: true }
  }
  async register(_data: Partial<Customer> & { password: string }) {
    await delay(1200)
    return { otpSent: true }
  }
  async verifyOtp(_phone: string, code: string) {
    await delay(1000)
    if (code.length !== 6) throw new Error('Code invalide')
    return { verified: true, customer: mockCustomers[0], token: 'mock-token' }
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
  async getRecharge(id: string): Promise<RechargeDetail> {
    await delay(400)
    const t = mockTransactions.find((x) => x.rechargeId === id)
    if (!t) throw new Error('Recharge introuvable')
    return {
      rechargeId: t.rechargeId, finalStatus: t.status, paymentStatus: 'CONFIRMED',
      correlationId: t.correlationId, meterId: t.meterId, amountXof: t.amount,
      createdAt: t.createdAt, updatedAt: t.createdAt, commands: [],
    }
  }
  async listTokens() { await delay(550); return mockTokens }
  async getToken(id: string) { await delay(400); return mockTokens.find((t) => t.tokenId === id) }
  async listAlerts() { await delay(500); return mockAlerts }
  async listIncidents() { await delay(600); return mockIncidents }
  async listAuditEvents(_correlationId?: string) { await delay(550); return mockAuditEvents }
  async listUsers() { await delay(500); return mockUsers }
  async listDevices() { await delay(550); return mockDevices }
  async listServices() { await delay(450); return mockServices }
}

// VITE_USE_MOCK_API : "false" bascule sur RealApiAdapter (vrais appels backend).
// Tout autre valeur (y compris absente) garde le mock — défaut sûr si la variable
// n'est pas définie (ex: preview/build oublié sans .env).
const useMock = import.meta.env.VITE_USE_MOCK_API !== 'false'

export const api: ApiAdapter = useMock ? new MockApiAdapter() : new RealApiAdapter()

// Meter id utilisé quand `customer.meterId` est vide (le backend n'a aujourd'hui aucune
// association Customer↔Meter, voir docs/05 §8 — c'est donc systématiquement le cas en
// mode réel). En mock : garde l'ancien id de démo. En réel : le seul compteur qui existe
// vraiment dans la base du PoC (V2__seed_lab_device.sql).
export const DEFAULT_METER_ID = useMock ? 'MTR-458921' : 'CIE-LAB-0001'

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
