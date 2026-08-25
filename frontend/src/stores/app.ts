import { create } from 'zustand'
import type { Customer, NotificationPrefs, AutoRechargeConfig, Alert } from '../types'
import { mockAlerts } from '../mocks/data'

interface Toast {
  id: number
  title: string
  message: string
  severity: 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'INFO'
}

interface AppState {
  customer: Customer | null
  setCustomer: (c: Customer | null) => void

  alerts: Alert[]
  pushAlert: (a: Alert) => void
  markAllRead: () => void

  toasts: Toast[]
  notify: (title: string, message: string, severity?: Toast['severity']) => void
  dismissToast: (id: number) => void

  prefs: NotificationPrefs
  setPref: (key: keyof NotificationPrefs, value: boolean) => void

  autoRecharge: AutoRechargeConfig
  setAutoRecharge: (cfg: Partial<AutoRechargeConfig>) => void
}

let toastId = 0

export const useAppStore = create<AppState>((set) => ({
  customer: null,
  setCustomer: (customer) => set({ customer }),

  alerts: mockAlerts,
  pushAlert: (a) => set((s) => ({ alerts: [a, ...s.alerts] })),
  markAllRead: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })) })),

  toasts: [],
  notify: (title, message, severity = 'INFO') =>
    set((s) => {
      toastId += 1
      const id = toastId
      setTimeout(() => set((s2) => ({ toasts: s2.toasts.filter((t) => t.id !== id) })), 5000)
      return { toasts: [...s.toasts, { id, title, message, severity }] }
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
}))
