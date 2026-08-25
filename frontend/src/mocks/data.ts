// MOCK DATA — jeux de données de démonstration cohérents (PoC uniquement)
import type {
  Customer, Meter, Token, Transaction, Alert, Incident, AuditEvent,
  DsiUser, Device, ServiceHealth, ConsumptionPoint,
} from '../types'

export const mockCustomers: Customer[] = [
  { customerId: 'CUST-001', firstName: 'Jean', lastName: 'KOUADIO', phone: '07 08 56 78 90', email: 'jean.kouadio@email.com', meterId: 'MTR-458921', contractId: 'CTR-2021-88412', createdAt: '2021-03-12T08:00:00Z' },
  { customerId: 'CUST-002', firstName: 'Aminata', lastName: 'TRAORE', phone: '05 44 21 09 33', email: 'aminata.traore@email.com', meterId: 'MTR-784512', contractId: 'CTR-2019-55231', createdAt: '2019-07-02T08:00:00Z' },
  { customerId: 'CUST-003', firstName: 'Yao', lastName: 'KOUASSI', phone: '01 02 33 44 55', email: 'yao.kouassi@email.com', meterId: 'MTR-901234', contractId: 'CTR-2022-10981', createdAt: '2022-01-18T08:00:00Z' },
  { customerId: 'CUST-004', firstName: 'Mariam', lastName: 'BAMBA', phone: '07 99 88 77 66', email: 'mariam.bamba@email.com', meterId: 'MTR-336699', contractId: 'CTR-2020-77654', createdAt: '2020-11-05T08:00:00Z' },
  { customerId: 'CUST-005', firstName: 'Serge', lastName: 'N’GUESSAN', phone: '05 11 22 33 44', email: 'serge.nguessan@email.com', meterId: 'MTR-112233', contractId: 'CTR-2023-33421', createdAt: '2023-04-27T08:00:00Z' },
]

export const mockMeters: Meter[] = [
  { meterId: 'MTR-458921', customerId: 'CUST-001', deviceId: 'DNG-0001', status: 'ONLINE', creditFcfa: 8500, creditKwh: 18.6, creditPercent: 32, creditStatus: 'NORMAL', autonomyDays: 6, lastHeartbeat: '2026-08-24T23:29:41Z', voltage: 228, current: 4.2, consumptionTodayKwh: 6.4, location: 'Abidjan, Cocody', alertCount: 1 },
  { meterId: 'MTR-784512', customerId: 'CUST-002', deviceId: 'DNG-0002', status: 'WARNING', creditFcfa: 1450, creditKwh: 3.2, creditPercent: 8, creditStatus: 'LOW', autonomyDays: 1, lastHeartbeat: '2026-08-24T23:28:12Z', voltage: 252, current: 6.8, consumptionTodayKwh: 9.1, location: 'Abidjan, Cocody', alertCount: 2 },
  { meterId: 'MTR-901234', customerId: 'CUST-003', deviceId: 'DNG-0003', status: 'OFFLINE', creditFcfa: 12400, creditKwh: 27.0, creditPercent: 45, creditStatus: 'NORMAL', autonomyDays: 9, lastHeartbeat: '2026-08-24T09:15:00Z', voltage: 0, current: 0, consumptionTodayKwh: 2.1, location: 'Yamoussoukro', alertCount: 1 },
  { meterId: 'MTR-336699', customerId: 'CUST-004', deviceId: 'DNG-0004', status: 'ONLINE', creditFcfa: 450, creditKwh: 1.0, creditPercent: 2, creditStatus: 'CRITICAL', autonomyDays: 0, lastHeartbeat: '2026-08-24T23:30:02Z', voltage: 224, current: 3.1, consumptionTodayKwh: 4.8, location: 'Bouaké', alertCount: 3 },
  { meterId: 'MTR-112233', customerId: 'CUST-005', deviceId: 'DNG-0005', status: 'ONLINE', creditFcfa: 25200, creditKwh: 54.9, creditPercent: 78, creditStatus: 'NORMAL', autonomyDays: 14, lastHeartbeat: '2026-08-24T23:29:55Z', voltage: 230, current: 2.4, consumptionTodayKwh: 3.2, location: 'Abidjan, Yopougon', alertCount: 0 },
  { meterId: 'MTR-220044', customerId: 'CUST-001', deviceId: 'DNG-0006', status: 'MAINTENANCE', creditFcfa: 0, creditKwh: 0, creditPercent: 0, creditStatus: 'CUT_RISK', autonomyDays: 0, lastHeartbeat: '2026-08-23T14:00:00Z', voltage: 0, current: 0, consumptionTodayKwh: 0, location: 'San-Pédro', alertCount: 0 },
  { meterId: 'MTR-550077', customerId: 'CUST-002', deviceId: 'DNG-0007', status: 'ONLINE', creditFcfa: 6100, creditKwh: 13.3, creditPercent: 24, creditStatus: 'WATCH', autonomyDays: 5, lastHeartbeat: '2026-08-24T23:29:12Z', voltage: 229, current: 5.0, consumptionTodayKwh: 7.7, location: 'Daloa', alertCount: 0 },
  { meterId: 'MTR-660088', customerId: 'CUST-003', deviceId: 'DNG-0008', status: 'ONLINE', creditFcfa: 15800, creditKwh: 34.4, creditPercent: 56, creditStatus: 'NORMAL', autonomyDays: 11, lastHeartbeat: '2026-08-24T23:30:10Z', voltage: 231, current: 1.8, consumptionTodayKwh: 2.9, location: 'Korhogo', alertCount: 0 },
  { meterId: 'MTR-770099', customerId: 'CUST-004', deviceId: 'DNG-0009', status: 'OFFLINE', creditFcfa: 3300, creditKwh: 7.2, creditPercent: 12, creditStatus: 'LOW', autonomyDays: 2, lastHeartbeat: '2026-08-24T18:42:00Z', voltage: 0, current: 0, consumptionTodayKwh: 1.4, location: 'Man', alertCount: 1 },
  { meterId: 'MTR-880011', customerId: 'CUST-005', deviceId: 'DNG-0010', status: 'ONLINE', creditFcfa: 9900, creditKwh: 21.6, creditPercent: 37, creditStatus: 'NORMAL', autonomyDays: 7, lastHeartbeat: '2026-08-24T23:29:58Z', voltage: 227, current: 3.6, consumptionTodayKwh: 5.5, location: 'Abidjan, Marcory', alertCount: 0 },
]

const providers = ['WAVE', 'ORANGE_MONEY', 'MTN_MONEY', 'MOOV_MONEY'] as const
// Statuts réalistes et proportionnés selon le flux réel : 90% succès, 5% pending, 5% failed/rejected
const statusWeights = [
  'CREDIT_APPLIED',       // 40%
  'CREDIT_APPLIED',
  'CREDIT_APPLIED',
  'CREDIT_APPLIED',
  'TOKEN_GENERATED',      // 20%
  'TOKEN_GENERATED',
  'COMMAND_SENT',         // 15%
  'COMMAND_SENT',
  'PAYMENT_CONFIRMED',    // 10%
  'PAYMENT_PENDING',      // 5%
  'PAYMENT_FAILED',       // 5%
  'COMMAND_REJECTED',     // 5%
] as const

const amounts = [1000, 2500, 5000, 5000, 10000, 25000]

// Générer un historique réaliste de 3-4 mois avec dates cohérentes
export const mockTransactions: Transaction[] = Array.from({ length: 64 }, (_, i) => {
  const n = i + 1
  const meter = mockMeters[i % 10]
  const amount = amounts[i % amounts.length]

  // Dates cohérentes : les plus récentes en premier (du 24 août au 24 mai)
  const dayOffset = Math.floor(i / 2) // 2 transactions par jour environ
  const txDate = new Date('2026-08-24T23:00:00Z')
  txDate.setDate(txDate.getDate() - dayOffset)

  // Format date de base
  const isoDate = txDate.toISOString()
  const hour = 8 + (i % 14)
  const minute = ((i * 13) % 60)
  const second = ((i * 7) % 60)
  const createdAt = isoDate.replace('T23:00:00.000Z', `T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}Z`)

  const status = statusWeights[i % statusWeights.length]

  return {
    transactionId: `TX-89342${(19832 + n * 7).toString().slice(-4)}`,
    paymentId: `PAY-2026-${(1000 + n).toString()}`,
    rechargeId: `RCG-2026-${(100 + n).toString().padStart(6, '0')}`,
    tokenId: `TK-2026-${(150 + n).toString().padStart(6, '0')}`,
    meterId: meter.meterId,
    customerId: meter.customerId,
    provider: providers[i % providers.length],
    amount,
    energyValue: +(amount / 458.7).toFixed(1),
    status,
    createdAt,
    correlationId: `CORR-82${(9000 + n * 17).toString()}`,
  }
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const mockTokens: Token[] = mockTransactions
  .filter((t) => t.status !== 'PAYMENT_FAILED' && t.status !== 'PAYMENT_PENDING')
  .map((t) => ({
    tokenId: t.tokenId,
    meterId: t.meterId,
    customerId: t.customerId,
    rechargeId: t.rechargeId,
    transactionId: t.transactionId,
    amount: t.amount,
    energyValue: t.energyValue,
    status: t.status,
    createdAt: t.createdAt,
    expiresAt: t.createdAt.replace('2026-', '2026-').replace(/-(\d{2})T/, (_, d) => `-${d}T`),
    commandId: `CMD-${t.transactionId.slice(-6)}`,
    correlationId: t.correlationId,
    tokenValue: `${1000 + (parseInt(t.tokenId.slice(-3)) * 7) % 9000} ${2000 + (parseInt(t.tokenId.slice(-3)) * 13) % 8000} ${3000 + (parseInt(t.tokenId.slice(-3)) * 21) % 7000} ${1111 + (parseInt(t.tokenId.slice(-3)) * 3) % 8888}`,
  }))

export const mockAlerts: Alert[] = [
  { alertId: 'AL-001', meterId: 'MTR-458921', type: 'LOW_CREDIT', severity: 'WARNING', message: 'Crédit faible — votre crédit est inférieur à 10 000 FCFA', createdAt: '2026-08-24T22:10:00Z', read: false },
  { alertId: 'AL-002', meterId: 'MTR-458921', type: 'RECHARGE_SUCCESS', severity: 'SUCCESS', message: 'Recharge de 5 000 FCFA appliquée avec succès', createdAt: '2026-08-24T23:22:00Z', read: false },
  { alertId: 'AL-003', meterId: 'MTR-458921', type: 'OVERVOLTAGE', severity: 'CRITICAL', message: 'Surtension détectée (252 V) — vérifiez vos équipements', createdAt: '2026-08-23T10:24:00Z', read: true },
  { alertId: 'AL-004', meterId: 'MTR-458921', type: 'METER_OFFLINE', severity: 'WARNING', message: 'Compteur hors ligne pendant 12 minutes', createdAt: '2026-08-22T09:15:00Z', read: true },
  { alertId: 'AL-005', meterId: 'MTR-458921', type: 'PAYMENT_FAILED', severity: 'CRITICAL', message: 'Paiement Wave de 2 500 FCFA échoué — veuillez réessayer', createdAt: '2026-08-21T18:40:00Z', read: true },
  { alertId: 'AL-006', meterId: 'MTR-458921', type: 'INJECTION_FAILED', severity: 'WARNING', message: 'Injection automatique échouée — token disponible en saisie manuelle', createdAt: '2026-08-20T08:32:00Z', read: true },
]

export const mockIncidents: Incident[] = [
  { incidentId: 'INC-1001', meterId: 'MTR-784512', customerName: 'Aminata TRAORE', type: 'Surtension détectée', severity: 'CRITICAL', status: 'OPEN', createdAt: '2026-08-24T10:24:00Z', location: 'Abidjan, Cocody' },
  { incidentId: 'INC-1002', meterId: 'MTR-901234', customerName: 'Yao KOUASSI', type: 'Compteur offline', severity: 'CRITICAL', status: 'ACK', createdAt: '2026-08-24T09:15:00Z', location: 'Yamoussoukro' },
  { incidentId: 'INC-1003', meterId: 'MTR-112233', customerName: 'Serge N’GUESSAN', type: 'Échec d’injection', severity: 'WARNING', status: 'OPEN', createdAt: '2026-08-24T08:32:00Z', location: 'Bouaké' },
  { incidentId: 'INC-1004', meterId: 'MTR-336699', customerName: 'Mariam BAMBA', type: 'Anomalie consommation', severity: 'WARNING', status: 'RESOLVED', createdAt: '2026-08-23T16:10:00Z', location: 'Bouaké' },
  { incidentId: 'INC-1005', meterId: 'MTR-770099', customerName: 'Mariam BAMBA', type: 'Perte télécom', severity: 'INFO', status: 'RESOLVED', createdAt: '2026-08-22T11:05:00Z', location: 'Man' },
]

export const mockAuditEvents: AuditEvent[] = [
  { eventId: 'EVT-9001', actor: 'payment-service', action: 'PAYMENT_CONFIRMED', resource: 'PAY-2026-1032', timestamp: '2026-08-24T23:21:12Z', correlationId: 'CORR-829173', status: 'SUCCESS' },
  { eventId: 'EVT-9002', actor: 'token-command-service', action: 'TOKEN_GENERATED', resource: 'TK-2026-000184', timestamp: '2026-08-24T23:21:45Z', correlationId: 'CORR-829173', status: 'SUCCESS' },
  { eventId: 'EVT-9003', actor: 'mqtt-gateway', action: 'COMMAND_SENT', resource: 'CMD-219832', timestamp: '2026-08-24T23:22:01Z', correlationId: 'CORR-829173', status: 'SUCCESS' },
  { eventId: 'EVT-9004', actor: 'DNG-0001', action: 'ACK_RECEIVED', resource: 'CMD-219832', timestamp: '2026-08-24T23:22:18Z', correlationId: 'CORR-829173', status: 'ACCEPTED' },
  { eventId: 'EVT-9005', actor: 'audit-service', action: 'CREDIT_APPLIED', resource: 'RCG-2026-000184', timestamp: '2026-08-24T23:22:20Z', correlationId: 'CORR-829173', status: 'SUCCESS' },
  { eventId: 'EVT-9006', actor: 'admin@cie.ci', action: 'USER_LOGIN', resource: 'user:ADM-001', timestamp: '2026-08-24T22:58:00Z', correlationId: 'CORR-829102', status: 'SUCCESS' },
  { eventId: 'EVT-9007', actor: 'payment-service', action: 'PAYMENT_FAILED', resource: 'PAY-2026-1029', timestamp: '2026-08-24T18:40:11Z', correlationId: 'CORR-828771', status: 'FAILED' },
  { eventId: 'EVT-9008', actor: 'mqtt-gateway', action: 'COMMAND_REJECTED', resource: 'CMD-219644', timestamp: '2026-08-24T15:12:44Z', correlationId: 'CORR-828312', status: 'REJECTED' },
]

export const mockUsers: DsiUser[] = [
  { userId: 'ADM-001', name: 'Admin CIE', email: 'admin@cie.ci', role: 'CIE_ADMIN', status: 'ACTIVE', lastLogin: '2026-08-24T22:58:00Z' },
  { userId: 'OPR-014', name: 'Koffi ASSI', email: 'k.assi@cie.ci', role: 'CIE_OPERATOR', status: 'ACTIVE', lastLogin: '2026-08-24T17:20:00Z' },
  { userId: 'DSI-002', name: 'Fatou DIALLO', email: 'f.diallo@cie.ci', role: 'DSI_ADMIN', status: 'ACTIVE', lastLogin: '2026-08-24T09:02:00Z' },
  { userId: 'CUST-001', name: 'Jean KOUADIO', email: 'jean.kouadio@email.com', role: 'CLIENT', status: 'ACTIVE', lastLogin: '2026-08-24T23:05:00Z' },
  { userId: 'OPR-021', name: 'Awa CISSE', email: 'a.cisse@cie.ci', role: 'CIE_OPERATOR', status: 'SUSPENDED', lastLogin: '2026-07-30T14:11:00Z' },
]

export const mockDevices: Device[] = mockMeters.map((m, i) => ({
  deviceId: m.deviceId,
  meterId: m.meterId,
  firmware: `v1.${(i % 3) + 2}.${i % 5}`,
  status: m.status,
  credentialStatus: i === 8 ? 'EXPIRING' : i === 5 ? 'REVOKED' : 'VALID',
  lastSeen: m.lastHeartbeat,
}))

export const mockServices: ServiceHealth[] = [
  { name: 'payment-service', status: 'UP', latencyMs: 42, uptimePercent: 99.98 },
  { name: 'token-command-service', status: 'UP', latencyMs: 38, uptimePercent: 99.95 },
  { name: 'device-service', status: 'UP', latencyMs: 51, uptimePercent: 99.9 },
  { name: 'audit-service', status: 'UP', latencyMs: 29, uptimePercent: 100 },
  { name: 'mqtt-gateway', status: 'DEGRADED', latencyMs: 210, uptimePercent: 98.7 },
  { name: 'notification-service', status: 'UP', latencyMs: 63, uptimePercent: 99.8 },
]

// Consommation simulée cohérente (base sinusoïdale + bruit déterministe)
function gen(labels: string[], base: number, variance: number): ConsumptionPoint[] {
  return labels.map((label, i) => {
    const kwh = +(base + Math.sin(i * 1.3) * variance + ((i * 37) % 10) / 10).toFixed(1)
    return { label, kwh, costFcfa: Math.round(kwh * 458.7), voltage: 226 + ((i * 7) % 9), current: +(2 + (kwh / base) * 2).toFixed(1) }
  })
}

export const mockConsumption: Record<string, ConsumptionPoint[]> = {
  jour: gen(['00h', '03h', '06h', '09h', '12h', '15h', '18h', '21h'], 0.9, 0.5),
  semaine: gen(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], 6.2, 1.8),
  mois: gen(['S1', 'S2', 'S3', 'S4'], 42, 8),
  trimestre: gen(['Juin', 'Juillet', 'Août'], 175, 25),
  année: gen(['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août'], 168, 30),
}

export const mockKpis = {
  parcTotal: 128450,
  online: 112589,
  offline: 15861,
  criticalAlerts: 342,
  rechargesToday: 2842,
  rechargesAmountToday: 28450000,
  paymentSuccessRate: 97.4,
  rechargeSuccessRate: 96.1,
  avgRechargeTimeSec: 8.2,
  failedCommands: 41,
  apiAvailability: 99.95,
}
