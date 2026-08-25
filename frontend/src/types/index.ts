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
}

export interface DsiUser {
  userId: string
  name: string
  email: string
  role: 'CLIENT' | 'CIE_OPERATOR' | 'CIE_ADMIN' | 'DSI_ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
  lastLogin: string
}

export interface Device {
  deviceId: string
  meterId: string
  firmware: string
  status: MeterStatus
  credentialStatus: 'VALID' | 'EXPIRING' | 'REVOKED'
  lastSeen: string
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
export const fmtFcfa = (n: number) => n.toLocaleString('fr-FR').replace(/\u202f/g, ' ') + ' FCFA'
export const fmtKwh = (n: number) => `${n.toFixed(1)} kWh`
