// Contrats TypeScript alignés sur le futur backend Quarkus (contract-first).
// Toutes les données de cette phase sont MOCK / SIMULATED.

export type CreditStatus = 'NORMAL' | 'WATCH' | 'LOW' | 'CRITICAL' | 'CUT_RISK'
export type MeterStatus = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'MAINTENANCE'
export type RechargeStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'TOKEN_GENERATED'
  | 'COMMAND_SENT'
  | 'CREDIT_APPLIED'
  | 'COMMAND_UNKNOWN'
  | 'COMMAND_REJECTED'

export type PaymentProvider = 'WAVE' | 'ORANGE_MONEY' | 'MTN_MONEY' | 'MOOV_MONEY'

export interface Customer {
  customerId: string
  firstName: string
  lastName: string
  phone: string
  email: string
  meterId: string
  contractId: string
  createdAt: string
}

export interface Meter {
  meterId: string
  customerId: string
  deviceId: string
  status: MeterStatus
  creditFcfa: number
  creditKwh: number
  creditPercent: number
  creditStatus: CreditStatus
  autonomyDays: number
  lastHeartbeat: string
  voltage: number
  current: number
  consumptionTodayKwh: number
  location: string
  alertCount: number
  // Absent côté mock ; renseigné par RealApiAdapter (ALG-01 simplifié, voir
  // docs/05_reconciliation-api-frontend-backend.md §3) : REAL si l'autonomie est calculée
  // à partir de vrais relevés, FALLBACK si l'historique est insuffisant.
  dataQuality?: 'REAL' | 'FALLBACK'
}

export interface Token {
  tokenId: string
  meterId: string
  customerId: string
  rechargeId: string
  transactionId: string
  amount: number
  energyValue: number
  status: RechargeStatus
  createdAt: string
  expiresAt: string
  commandId: string
  correlationId: string
  tokenValue: string // valeur masquable — MOCK uniquement
}

export interface Transaction {
  transactionId: string
  paymentId: string
  rechargeId: string
  tokenId: string
  meterId: string
  customerId: string
  provider: PaymentProvider
  amount: number
  energyValue: number
  status: RechargeStatus
  createdAt: string
  correlationId: string
}

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS'

export interface Alert {
  alertId: string
  meterId: string
  type: string
  severity: AlertSeverity
  message: string
  createdAt: string
  read: boolean
}

export interface ConsumptionPoint {
  label: string
  kwh: number
  costFcfa: number
  voltage: number
  current: number
}

export interface Incident {
  incidentId: string
  meterId: string
  customerName: string
  type: string
  severity: AlertSeverity
  status: 'OPEN' | 'ACK' | 'RESOLVED'
  createdAt: string
  location: string
}

export interface AuditEvent {
  eventId: string
  actor: string
  action: string
  resource: string
  timestamp: string
  correlationId: string
  status: string
  // Absent côté mock ; renseigné par RealApiAdapter quand le backend le fournit
  // (voir docs/05_reconciliation-api-frontend-backend.md §4).
  errorCode?: string | null
}

// ─── Formes réelles du backend (RealApiAdapter uniquement) ───
// Correspond exactement à RechargeDetailResponse (backend) et CommandSummary —
// distinct du type `Transaction` (mock) pour ne pas mélanger les deux contrats.
// Voir docs/05_reconciliation-api-frontend-backend.md §2.

export interface CommandSummary {
  commandId: string
  deviceId: string
  status: string
  sequence: number
  retryCount: number
  sentAt: string | null
  ackAt: string | null
}

export interface RechargeDetail {
  rechargeId: string
  finalStatus: string
  // Peut être null : recharge de recette sans Payment réel derrière (voir backend).
  paymentStatus: string | null
  correlationId: string
  meterId: string
  amountXof: number
  createdAt: string
  updatedAt: string
  commands: CommandSummary[]
}

// Correspond à DeviceController (backend) — beaucoup plus pauvre que le type `Meter`
// (mock) : pas de creditPercent/autonomyDays/creditStatus/voltage/current/location/
// consumptionTodayKwh/alertCount côté backend aujourd'hui (voir docs/05 §3, ALG-01 non
// implémenté). RealApiAdapter.getMeter() complète ces champs avec des valeurs neutres
// documentées plutôt que de les inventer.
export interface MeterStatusResponse {
  meterId: string
  deviceId: string
  deviceStatus: string
  lastSeen: string | null
  onlineStatus: boolean
  creditBalance: number
  creditUnit: string
  // ALG-01 simplifié (voir CreditAutonomyService, docs/05 §3) : NORMAL/WARNING/CRITICAL/
  // IMMEDIATE côté backend — 4 valeurs, pas les 5 de CreditStatus (frontend) — voir le
  // mapping dans realApi.ts.
  autonomyDays: number
  creditStatus: string
  dataQuality: 'REAL' | 'FALLBACK'
}

export interface DsiUser {
  userId: string
  name: string
  email: string
  phone: string
  role: 'CLIENT' | 'CIE_OPERATOR' | 'CIE_ADMIN' | 'DSI_ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
  lastLogin: string
  meterId: string
  contractId: string
  createdAt: string
}

export interface Device {
  deviceId: string
  meterId: string
  firmware: string
  status: MeterStatus
  credentialStatus: 'VALID' | 'EXPIRING' | 'REVOKED'
  lastSeen: string
}

// Registre des compteurs connus de la CIE (admin), base de l'association Client<->Compteur
// réelle à l'inscription -- distinct de Device (un compteur peut exister sans dongle).
export interface MeterRegistryEntry {
  meterId: string
  label: string | null
  createdAt: string
  hasDevice: boolean
  claimedByCustomerId: string | null
}

export interface ServiceHealth {
  name: string
  status: 'UP' | 'DEGRADED' | 'DOWN'
  latencyMs: number
  uptimePercent: number
}

export interface NotificationPrefs {
  master: boolean
  lowCredit: boolean
  criticalCredit: boolean
  overvoltage: boolean
  rechargeSuccess: boolean
  paymentFailed: boolean
  meterOffline: boolean
}

export interface AutoRechargeConfig {
  enabled: boolean
  thresholdFcfa: number
  amountFcfa: number
  provider: PaymentProvider
  dailyCapFcfa: number
  monthlyCapFcfa: number
}

// Tarif MOCK — configurable, ne représente PAS le tarif CIE réel
export const MOCK_TARIFF_FCFA_PER_KWH = 458.7
export const fcfaToKwh = (fcfa: number) => fcfa / MOCK_TARIFF_FCFA_PER_KWH
export const fmtFcfa = (n: number) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/\u202f/g, ' ') + ' FCFA'
export const fmtKwh = (n: number) => `${n.toFixed(1)} kWh`
