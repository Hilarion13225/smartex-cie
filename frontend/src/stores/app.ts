import { create } from 'zustand'
import type { Customer, NotificationPrefs, AutoRechargeConfig, Alert, PaymentProvider } from '../types'
import { mockAlerts } from '../mocks/data'

// ─── Stockage du JWT ───
// Choix : sessionStorage (backing store) + Zustand (cache réactif en mémoire pour l'UI).
//
// Pourquoi sessionStorage plutôt que :
// - mémoire seule (pas de storage) : perdrait la session à chaque rafraîchissement de
//   page, inacceptable en usage normal (l'utilisateur recharge/navigue dans une PWA).
// - localStorage : persiste indéfiniment entre redémarrages du navigateur — un token volé
//   par XSS resterait exploitable bien après la fermeture de l'onglet.
// - cookie httpOnly : la meilleure option contre le vol par XSS (illisible en JS), mais le
//   backend renvoie aujourd'hui le JWT dans le corps JSON de /auth/verify-otp, pas via
//   Set-Cookie — l'activer nécessiterait un changement backend (flags Secure/SameSite,
//   protection CSRF), explicitement hors périmètre de cette branche (frontend uniquement).
//
// Compromis assumé : sessionStorage reste lisible par tout script injecté (même exposition
// XSS que localStorage), mais scope au seul onglet (fermeture = perte du token, contrairement
// à localStorage) et le JWT a de toute façon une expiration bornée côté backend (24h par
// défaut, JwtService). Acceptable pour ce PoC de labo ; à revoir (cookie httpOnly + CSRF)
// avant tout usage au-delà du poste de développement local.
const TOKEN_STORAGE_KEY = 'cie_poc_jwt'
const PENDING_PHONE_STORAGE_KEY = 'cie_poc_pending_phone'

const readStoredToken = (): string | null => {
  try { return sessionStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
}
const writeStoredToken = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
    else sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch { /* sessionStorage indisponible (mode privé strict, etc.) — dégrade sans planter */ }
}

interface Toast {
  id: number
  title: string
  message: string
  severity: 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'INFO'
}

interface TransactionRecord {
  id: string
  date: string
  amount: number
  provider: PaymentProvider
  status: 'success' | 'failed'
  meterId: string
}

interface AppState {
  customer: Customer | null
  setCustomer: (c: Customer | null) => void

  // JWT courant (voir note de stockage ci-dessus). null = non authentifié.
  token: string | null
  setToken: (t: string | null) => void

  // Numéro de téléphone en attente de vérification OTP, entre login/register et
  // l'écran /verification (le backend exige phoneNumber + code pour verify-otp).
  pendingPhone: string | null
  setPendingPhone: (phone: string | null) => void

  // Déconnexion complète : efface customer + token (session/store + sessionStorage).
  // Appelé par httpClient sur un 401 (token absent/expiré/invalide sur un appel protégé).
  clearSession: () => void

  alerts: Alert[]
  pushAlert: (a: Alert) => void
  markAllRead: () => void
  removeAlert: (alertId: string) => void
  // Remplace la liste (voir ClientLayout, fetch initial via api.listAlerts() -- en mode
  // réel, dérivé en direct d'ALG-01, voir RealApiAdapter.listAlerts).
  setAlerts: (alerts: Alert[]) => void

  toasts: Toast[]
  // Toute notification est aussi enregistrée dans `alerts` (voir AlertsPage,
  // "Alertes & Sécurité") -- pas seulement affichée puis perdue comme toast éphémère.
  // `type`/`meterId` optionnels pour les appelants qui ont un contexte plus précis
  // (ex: DemoPage, RechargeStatus) ; à défaut, `type` reprend `title` et `meterId` le
  // compteur du client connecté (chaîne vide si inconnu, jamais inventé).
  notify: (title: string, message: string, severity?: Toast['severity'], type?: string, meterId?: string) => void
  dismissToast: (id: number) => void

  prefs: NotificationPrefs
  setPref: (key: keyof NotificationPrefs, value: boolean) => void

  autoRecharge: AutoRechargeConfig
  setAutoRecharge: (cfg: Partial<AutoRechargeConfig>) => void

  transactions: TransactionRecord[]
  addTransaction: (t: Omit<TransactionRecord, 'id' | 'date'>) => void

  lastPaymentAmount: number
  setLastPaymentAmount: (amount: number) => void
}

let toastId = 0

export const useAppStore = create<AppState>((set, get) => ({
  customer: null,
  setCustomer: (customer) => set({ customer }),

  token: readStoredToken(),
  setToken: (token) => { writeStoredToken(token); set({ token }) },

  pendingPhone: (() => {
    try { return sessionStorage.getItem(PENDING_PHONE_STORAGE_KEY) } catch { return null }
  })(),
  setPendingPhone: (phone) => {
    try {
      if (phone) sessionStorage.setItem(PENDING_PHONE_STORAGE_KEY, phone)
      else sessionStorage.removeItem(PENDING_PHONE_STORAGE_KEY)
    } catch { /* voir writeStoredToken */ }
    set({ pendingPhone: phone })
  },

  clearSession: () => { writeStoredToken(null); set({ customer: null, token: null }) },

  // Seed initiale avant le premier fetch (ClientLayout appelle api.listAlerts() au montage
  // et remplace via setAlerts -- mockAlerts ici uniquement pour ne pas afficher un écran
  // vide le temps du premier appel réseau en mode mock, où le round-trip est simulé).
  alerts: mockAlerts,
  pushAlert: (a) => set((s) => ({ alerts: [a, ...s.alerts] })),
  markAllRead: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })) })),
  removeAlert: (alertId) => set((s) => ({ alerts: s.alerts.filter((a) => a.alertId !== alertId) })),
  setAlerts: (alerts) => set({ alerts }),

  toasts: [],
  notify: (title, message, severity = 'INFO', type, meterId) =>
    set((s) => {
      toastId += 1
      const id = toastId
      setTimeout(() => set((s2) => ({ toasts: s2.toasts.filter((t) => t.id !== id) })), 5000)
      const alert: Alert = {
        alertId: `AL-${Date.now()}-${id}`,
        meterId: meterId ?? get().customer?.meterId ?? '',
        type: type ?? title,
        severity,
        message,
        createdAt: new Date().toISOString(),
        read: false,
      }
      return { toasts: [...s.toasts, { id, title, message, severity }], alerts: [alert, ...s.alerts] }
    }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  prefs: {
    master: true, lowCredit: true, criticalCredit: true, overvoltage: true,
    rechargeSuccess: true, paymentFailed: true, meterOffline: true,
  },
  setPref: (key, value) => set((s) => ({ prefs: { ...s.prefs, [key]: value } })),

  autoRecharge: {
    enabled: false, thresholdFcfa: 2000, amountFcfa: 5000,
    provider: 'WAVE', dailyCapFcfa: 10000, monthlyCapFcfa: 50000,
  },
  setAutoRecharge: (cfg) => set((s) => ({ autoRecharge: { ...s.autoRecharge, ...cfg } })),

  transactions: [],
  addTransaction: (t) => set((s) => ({
    transactions: [{
      ...t,
      id: `TXN-${Date.now()}`,
      date: new Date().toLocaleString("fr-FR"),
    }, ...s.transactions],
  })),

  lastPaymentAmount: 0,
  setLastPaymentAmount: (amount) => set({ lastPaymentAmount: amount }),
}))

/** Rôle du customer courant (CLIENT/CIE_OPERATOR/CIE_ADMIN/DSI_ADMIN), si connu.
 * Attaché uniquement par RealApiAdapter (voir services/realApi.ts, RealCustomer) — le
 * type partagé `Customer` (mock-first) ne déclare pas ce champ. Renvoie null en mode
 * mock ou avant toute connexion. Utilisé pour la redirection post-login. */
export function currentCustomerRole(): string | null {
  const c = useAppStore.getState().customer as (Customer & { role?: string }) | null
  return c?.role ?? null
}
