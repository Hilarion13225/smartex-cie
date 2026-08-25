import { create } from 'zustand'
import type { PaymentProvider } from '../types'
import type { SimulatedRecharge } from '../services/api'

interface RechargeState {
  amount: number
  provider: PaymentProvider
  recharge: SimulatedRecharge | null
  outcome: 'success' | 'injection_failed' | 'payment_failed'
  setAmount: (n: number) => void
  setProvider: (p: PaymentProvider) => void
  setRecharge: (r: SimulatedRecharge | null) => void
  setOutcome: (o: RechargeState['outcome']) => void
}

export const useRechargeStore = create<RechargeState>((set) => ({
  amount: 5000,
  provider: 'WAVE',
  recharge: null,
  outcome: 'success',
  setAmount: (amount) => set({ amount }),
  setProvider: (provider) => set({ provider }),
  setRecharge: (recharge) => set({ recharge }),
  setOutcome: (outcome) => set({ outcome }),
}))
