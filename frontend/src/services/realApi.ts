// Adaptateur HTTP réel — appelle le backend Spring Boot (backend/poc-backend).
// Voir docs/05_reconciliation-api-frontend-backend.md pour la justification de chaque
// mapping (chemin, champs) et api.ts pour la liste des endpoints sans équivalent backend
// (ceux-là restent servis par des données mock même dans cet adaptateur, avec un
// commentaire à chaque endroit — pas d'invention de comportement backend côté frontend).

import type {
  Customer, Meter, AuditEvent, RechargeDetail, MeterStatusResponse, Transaction,
  Alert, AlertSeverity, DsiUser, Device, MeterStatus,
  ConsumptionPoint, CreditStatus, PaymentProvider, RechargeStatus,
} from '../types'
import { fcfaToKwh } from '../types'
import type { ApiAdapter, SimulatedRecharge } from './api'
import { http } from './httpClient'
import { useAppStore } from '../stores/app'
import { mockTokens, mockIncidents, mockServices } from '../mocks/data'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Seul meter réel de ce PoC (V2__seed_lab_device.sql) — miroir de DEFAULT_METER_ID (api.ts,
// pas ré-importé ici pour éviter une dépendance circulaire api.ts <-> realApi.ts).
const LAB_METER_ID = 'CIE-LAB-0001'

// Backend CustomerResponse : customerId, phoneNumber, displayName, role, phoneVerified,
// createdAt, lastLoginAt — pas de firstName/lastName séparés, pas d'email, pas de
// meterId/contractId (aucune association Customer↔Meter n'existe encore côté backend,
// voir docs/05 §8 item 4). On mappe du mieux possible vers le type frontend Customer sans
// inventer les champs manquants (chaînes vides plutôt que valeurs plausibles mais fausses).
export type BackendRole = 'CLIENT' | 'CIE_OPERATOR' | 'CIE_ADMIN' | 'DSI_ADMIN'

interface BackendCustomer {
  customerId: string
  phoneNumber: string
  displayName: string
  role: BackendRole
  phoneVerified: boolean
  createdAt: string
  lastLoginAt: string | null
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

// ALG-01 simplifié (backend) : NORMAL/WARNING/CRITICAL/IMMEDIATE, 4 niveaux. CreditStatus
// (frontend, docs/03 complet) : NORMAL/WATCH/LOW/CRITICAL/CUT_RISK, 5 niveaux. Les seuils
// backend correspondent exactement aux 3 premiers seuils frontend (>7j / <=7j / <=3j) —
// seul le dernier niveau frontend (CUT_RISK, <=0.125j) n'a pas d'équivalent : le backend
// simplifié ne distingue pas "<=1j" de "<=0.125j", donc IMMEDIATE se mappe sur CRITICAL
// (le niveau le plus sévère que le backend puisse réellement produire).
function mapCreditStatus(backend: string): CreditStatus {
  switch (backend) {
    case 'NORMAL': return 'NORMAL'
    case 'WARNING': return 'WATCH'
    case 'CRITICAL': return 'LOW'
    case 'IMMEDIATE': return 'CRITICAL'
    default: return 'NORMAL'
  }
}

function mapMeter(s: MeterStatusResponse): Meter {
  return {
    meterId: s.meterId,
    customerId: '',
    deviceId: s.deviceId,
    status: s.onlineStatus ? 'ONLINE' : 'OFFLINE', // backend n'a pas WARNING/MAINTENANCE
    creditFcfa: s.creditUnit === 'FCFA' || s.creditUnit === 'XOF' ? s.creditBalance : 0,
    creditKwh: 0,
    // Pas de creditPercent : dans un système prépayé il n'y a pas de plafond naturel
    // (contrairement à une batterie) -- voir docs/05 §3, point ouvert avec le produit.
    creditPercent: 0,
    creditStatus: mapCreditStatus(s.creditStatus),
    autonomyDays: s.autonomyDays,
    dataQuality: s.dataQuality,
    lastHeartbeat: s.lastSeen ?? '',
    voltage: 0, // non simulé côté backend/mock-dongle
    current: 0,
    consumptionTodayKwh: 0, // voir getConsumption pour l'historique réel, pas dupliqué ici
    location: '',
    alertCount: 0,
  }
}

// UNKNOWN (device jamais encore vu en heartbeat) -> OFFLINE : plus sûr qu'un WARNING/
// MAINTENANCE que le backend ne sait de toute façon pas distinguer (DeviceStatus n'a que
// UNKNOWN/ONLINE/OFFLINE, voir Device.java).
function mapDeviceStatus(backend: string): MeterStatus {
  return backend === 'ONLINE' ? 'ONLINE' : 'OFFLINE'
}

interface BackendDeviceSummary {
  deviceId: string
  meterId: string
  firmwareVersion: string | null
  status: string
  credentialStatus: string
  lastSeen: string | null
}

interface BackendRechargeSummary {
  rechargeId: string
  paymentId: string
  meterId: string
  customerId: string
  provider: string | null
  amountXof: number
  status: string
  correlationId: string
  createdAt: string
}

// Backend (7 valeurs, ALG-02) -> frontend (9 valeurs, inclut le cycle paiement que
// RechargeStatus backend ne modélise pas séparément). COMMAND_TIMEOUT n'a pas
// d'équivalent exact -> COMMAND_UNKNOWN (le plus honnête : l'issue n'est pas encore connue
// du point de vue client). FALLBACK_TOKEN_SENT (succès dégradé, ALG-02 étape 8) -> mappé
// sur COMMAND_SENT, le plus proche sémantiquement (commande traitée, action requise côté
// client) parmi les valeurs existantes.
function mapRechargeStatus(backend: string): RechargeStatus {
  switch (backend) {
    case 'CREATED': return 'CREATED'
    case 'TOKEN_GENERATED': return 'TOKEN_GENERATED'
    case 'COMMAND_SENT': return 'COMMAND_SENT'
    case 'CREDIT_APPLIED': return 'CREDIT_APPLIED'
    case 'COMMAND_REJECTED': return 'COMMAND_REJECTED'
    case 'COMMAND_TIMEOUT': return 'COMMAND_UNKNOWN'
    case 'FALLBACK_TOKEN_SENT': return 'COMMAND_SENT'
    default: return 'COMMAND_UNKNOWN'
  }
}

function mapTransaction(r: BackendRechargeSummary): Transaction {
  return {
    // Pas de concept "transactionId" distinct côté backend (voir CLAUDE.md : le paiement
    // EST la transaction) -- paymentId en fait office.
    transactionId: r.paymentId,
    paymentId: r.paymentId,
    rechargeId: r.rechargeId,
    // Le token n'est jamais exposé en clair (RG-C-005) -- aucun identifiant à donner ici.
    tokenId: '',
    meterId: r.meterId,
    customerId: r.customerId,
    // Le provider réel du payment-simulator ("PAYMENT_SIMULATOR") ne correspond à aucune
    // des 4 valeurs de l'enum frontend (WAVE/ORANGE_MONEY/MTN_MONEY/MOOV_MONEY, elles-mêmes
    // sans trace dans docs/03, voir docs/05 §7) -- passé tel quel plutôt que remplacé par un
    // opérateur plausible mais faux ; peut donc afficher un badge/libellé "inconnu" dans
    // l'UI. `provider` peut aussi être null (recharge de recette sans Payment réel).
    provider: (r.provider ?? 'PAYMENT_SIMULATOR') as PaymentProvider,
    amount: r.amountXof,
    energyValue: +fcfaToKwh(r.amountXof).toFixed(1),
    status: mapRechargeStatus(r.status),
    createdAt: r.createdAt,
    correlationId: r.correlationId,
  }
}

const PERIOD_BUCKETS: Record<string, { bucketCount: number; bucketHours: number }> = {
  jour: { bucketCount: 8, bucketHours: 3 },
  semaine: { bucketCount: 7, bucketHours: 24 },
  mois: { bucketCount: 4, bucketHours: 24 * 7 },
  trimestre: { bucketCount: 3, bucketHours: 24 * 30 },
  année: { bucketCount: 8, bucketHours: 24 * 30 },
}

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

// Libellés d'affichage construits ici (souci d'UI, pas de logique métier) à partir de
// bucketStart (le seul instant exact renvoyé par le backend, voir ConsumptionBucket.java).
function bucketLabel(period: string, bucketStart: Date, index: number): string {
  switch (period) {
    case 'jour': return `${bucketStart.getHours().toString().padStart(2, '0')}h`
    case 'semaine': return WEEKDAYS[bucketStart.getDay()]
    case 'mois': return `S${index + 1}`
    default: return MONTHS[bucketStart.getMonth()]
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
    return mapMeter(s)
  }

  // GET /api/v1/meters (liste flotte, réservé CIE_OPERATOR/CIE_ADMIN/DSI_ADMIN) — un seul
  // meter existe réellement dans ce PoC, contrairement au jeu de démo mock (10 meters).
  async listMeters() {
    const statuses = await http.get<MeterStatusResponse[]>('/api/v1/meters')
    return statuses.map(mapMeter)
  }

  // GET /api/v1/meters/{meterId}/consumption — bucketé, reconstruit à partir de vrais
  // relevés (voir ConsumptionHistoryService). Le meterId n'est pas un paramètre de
  // l'interface ApiAdapter (mock-first) : on utilise le seul meter réel du PoC.
  async getConsumption(period: string): Promise<ConsumptionPoint[]> {
    const config = PERIOD_BUCKETS[period] ?? PERIOD_BUCKETS.semaine
    const buckets = await http.get<Array<{
      bucketStart: string; bucketEnd: string; consumptionFcfa: number; dataQuality: string
    }>>(`/api/v1/meters/${LAB_METER_ID}/consumption?bucketCount=${config.bucketCount}`
        + `&bucketHours=${config.bucketHours}`, false)
    return buckets.map((b, i) => ({
      label: bucketLabel(period, new Date(b.bucketStart), i),
      kwh: +fcfaToKwh(b.consumptionFcfa).toFixed(1),
      costFcfa: Math.round(b.consumptionFcfa),
      voltage: 0, // non simulé côté backend/mock-dongle
      current: 0,
    }))
  }

  // GET /api/v1/recharges?customerId= — historique des transactions du client connecté.
  // Pas de customerId en session (mode réel, tant que Customer↔Meter n'existe pas) ->
  // liste vide plutôt qu'une erreur (cohérent avec "jamais de valeur inventée").
  async listTransactions(): Promise<Transaction[]> {
    const customerId = useAppStore.getState().customer?.customerId
    if (!customerId) return []
    const summaries = await http.get<BackendRechargeSummary[]>(
      `/api/v1/recharges?customerId=${encodeURIComponent(customerId)}`)
    return summaries.map(mapTransaction)
  }

  async getTransaction(id: string) {
    const all = await this.listTransactions()
    return all.find((t) => t.transactionId === id)
  }

  async getRecharge(id: string): Promise<RechargeDetail> {
    return http.get<RechargeDetail>(`/api/v1/recharges/${id}`)
  }

  // POST /api/v1/recharges — flux client réel (voir README §Scénario T01). idempotencyKey
  // généré une seule fois par tentative (crypto.randomUUID, disponible nativement dans le
  // navigateur) pour ne jamais dupliquer une recharge sur un double-clic/retry réseau.
  async createRecharge(amount: number, provider: PaymentProvider, meterId: string): Promise<SimulatedRecharge> {
    const customerId = useAppStore.getState().customer?.customerId
    if (!customerId) throw new Error('Non connecté')
    const idempotencyKey = `APP-${customerId}-${crypto.randomUUID()}`
    const created = await http.post<{
      rechargeId: string; status: string; correlationId: string; meterId: string; amountXof: number
    }>('/api/v1/recharges', { customerId, meterId, amount, channel: 'APP', paymentProvider: provider, idempotencyKey })
    return {
      rechargeId: created.rechargeId,
      // Pas de concept "transactionId" distinct côté backend (voir mapTransaction) --
      // rechargeId en fait office, unique et réel.
      transactionId: created.rechargeId,
      // Ni tokenId ni tokenValue : le token n'est jamais exposé en clair (RG-C-005) --
      // voir TokenDetailPage/TokenFallback, adaptés pour ne jamais en inventer un.
      tokenId: '',
      commandId: '',
      correlationId: created.correlationId,
      amount: created.amountXof,
      energyValue: +fcfaToKwh(created.amountXof).toFixed(1),
      provider,
      meterId: created.meterId,
      tokenValue: '',
    }
  }

  // Pas d'équivalent backend (le token n'est jamais exposé en clair, RG-C-005) — reste mock.
  async listTokens() { await delay(300); return mockTokens }
  async getToken(id: string) { await delay(200); return mockTokens.find((t) => t.tokenId === id) }

  // Dérivé en direct de l'autonomie ALG-01 réelle (GET /meters/{id}/status), pas persisté,
  // pas de déduplication ni de suivi "lu/non lu" (recalculé à chaque appel) : ce n'est PAS
  // un moteur d'alerte (incident-service/rules-engine sont hors scope PoC, voir CLAUDE.md/
  // README) -- juste un reflet honnête du signal réel déjà calculé, pas une valeur inventée.
  async listAlerts(): Promise<Alert[]> {
    const meter = await this.getMeter(LAB_METER_ID)
    if (meter.creditStatus === 'NORMAL') return []
    const severity: AlertSeverity =
      meter.creditStatus === 'LOW' || meter.creditStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING'
    return [{
      alertId: `LIVE-${LAB_METER_ID}-${meter.creditStatus}`,
      meterId: LAB_METER_ID,
      type: 'LOW_CREDIT',
      severity,
      message: `Autonomie estimée : ${meter.autonomyDays.toFixed(1)} jour(s)`
        + (meter.dataQuality === 'FALLBACK' ? ' (estimation, historique insuffisant)' : ''),
      createdAt: new Date().toISOString(),
      read: false,
    }]
  }

  // Pas d'équivalent backend : construire un vrai cycle de vie d'incident (OPEN/ACK/
  // RESOLVED, assignation, etc.) suppose un incident-service — explicitement listé
  // "hors scope PoC actuel" (README, CLAUDE.md), pas juste "pas encore fait". Inventer ce
  // workflow ici serait fabriquer une fonctionnalité produit, pas connecter une existante.
  async listIncidents() { await delay(400); return mockIncidents }

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

  // GET /api/v1/customers (liste, réservé CIE_ADMIN/DSI_ADMIN).
  async listUsers(): Promise<DsiUser[]> {
    const customers = await http.get<BackendCustomer[]>('/api/v1/customers')
    return customers.map((c) => ({
      userId: c.customerId,
      name: c.displayName,
      email: '', // pas de champ email côté backend (voir mapCustomer)
      role: c.role,
      // Aucun mécanisme de suspension côté backend aujourd'hui -- toujours ACTIVE, valeur
      // neutre documentée plutôt qu'inventée (voir docs/05).
      status: 'ACTIVE',
      lastLogin: c.lastLoginAt ?? '',
    }))
  }

  // GET /api/v1/devices (liste, réservé CIE_OPERATOR/CIE_ADMIN/DSI_ADMIN).
  async listDevices(): Promise<Device[]> {
    const devices = await http.get<BackendDeviceSummary[]>('/api/v1/devices')
    return devices.map((d) => ({
      deviceId: d.deviceId,
      meterId: d.meterId,
      firmware: d.firmwareVersion ?? '',
      status: mapDeviceStatus(d.status),
      // Toujours "VALID" côté backend : pas de suivi d'expiration/révocation de certificat
      // par device aujourd'hui (voir DeviceSummaryResponse.java), valeur neutre documentée.
      credentialStatus: d.credentialStatus as Device['credentialStatus'],
      lastSeen: d.lastSeen ?? '',
    }))
  }

  // Pas d'équivalent backend : ce PoC est UN SEUL déployable Spring Boot (voir CLAUDE.md),
  // pas les 6 microservices Java + 5 Node de l'architecture V2 -- il n'y a littéralement
  // rien à interroger pour un statut par "service". Construire un faux statut par nom de
  // package serait une donnée inventée, pas une connexion à quelque chose de réel.
  async listServices() { await delay(300); return mockServices }
}
