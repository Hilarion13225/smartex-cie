import type { ReactNode } from 'react'
import { useAppStore } from '../stores/app'
import type { AlertSeverity, CreditStatus, MeterStatus, RechargeStatus } from '../types'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>{children}</div>
}

export function Button({
  children, onClick, variant = 'primary', className = '', disabled, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'wave' | 'danger' | 'ghost'
  className?: string; disabled?: boolean; type?: 'button' | 'submit'
}) {
  const styles = {
    primary: 'bg-cie-600 hover:bg-cie-700 text-white',
    secondary: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-800',
    wave: 'bg-wave-500 hover:bg-wave-600 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'text-cie-600 hover:bg-cie-50',
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-3 font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: string }) {
  const map: Record<string, string> = {
    green: 'bg-cie-50 text-cie-700',
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[color]}`}>{children}</span>
}

export function MeterStatusBadge({ status }: { status: MeterStatus }) {
  const map: Record<MeterStatus, [string, string]> = {
    ONLINE: ['EN LIGNE', 'green'], OFFLINE: ['OFFLINE', 'red'],
    WARNING: ['WARNING', 'orange'], MAINTENANCE: ['MAINTENANCE', 'gray'],
  }
  return <Badge color={map[status][1]}>{map[status][0]}</Badge>
}

export function CreditStatusBadge({ status }: { status: CreditStatus }) {
  const map: Record<CreditStatus, string> = {
    NORMAL: 'green', WATCH: 'blue', LOW: 'orange', CRITICAL: 'red', CUT_RISK: 'red',
  }
  return <Badge color={map[status]}>{status}</Badge>
}

export function RechargeStatusBadge({ status }: { status: RechargeStatus }) {
  const color =
    status === 'CREDIT_APPLIED' ? 'green'
    : status === 'PAYMENT_FAILED' || status === 'COMMAND_REJECTED' ? 'red'
    : status === 'PAYMENT_PENDING' || status === 'COMMAND_UNKNOWN' ? 'orange'
    : 'blue'
  return <Badge color={color}>{status}</Badge>
}

export function SeverityDot({ severity }: { severity: AlertSeverity }) {
  const map: Record<AlertSeverity, string> = {
    SUCCESS: 'bg-cie-500', WARNING: 'bg-orange-500', CRITICAL: 'bg-red-500', INFO: 'bg-blue-500',
  }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[severity]}`} />
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition ${on ? 'bg-cie-600' : 'bg-gray-300'}`}
      aria-pressed={on}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function Spinner({ wave = false, className = '' }: { wave?: boolean; className?: string }) {
  return <div className={`spinner ${wave ? 'spinner-wave' : ''} ${className}`} />
}

export function FullScreenLoader({ title, subtitle, wave = false }: { title: string; subtitle?: string; wave?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-white/95 flex flex-col items-center justify-center gap-4 animate-slide-up">
      <Spinner wave={wave} />
      <div className="text-center">
        <p className="font-semibold text-gray-800">{title}</p>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

export function Toasts() {
  const { toasts, dismissToast } = useAppStore()
  const border: Record<string, string> = {
    SUCCESS: 'border-l-cie-500', WARNING: 'border-l-orange-500', CRITICAL: 'border-l-red-500', INFO: 'border-l-blue-500',
  }
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`animate-toast bg-white rounded-xl shadow-lg border border-gray-100 border-l-4 ${border[t.severity]} p-3 flex items-start gap-2`}>
          <SeverityDot severity={t.severity} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{t.title}</p>
            <p className="text-xs text-gray-500">{t.message}</p>
          </div>
          <button onClick={() => dismissToast(t.id)} className="text-gray-400 text-sm">✕</button>
        </div>
      ))}
    </div>
  )
}

export function CieLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-lg' : 'text-2xl'
  return (
    <span className={`font-black tracking-tight ${cls}`}>
      <span className="text-gray-900">C</span>
      <span className="text-orange-500">i</span>
      <span className="text-cie-600">E</span>
    </span>
  )
}

export function QrPlaceholder({ seed, className = '' }: { seed: string; className?: string }) {
  // QR code simulé (MOCK) — motif déterministe basé sur le seed
  const cells: boolean[] = []
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  for (let i = 0; i < 441; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    cells.push((h >> 16) % 3 === 0)
  }
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#111" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#111" />
    </g>
  )
  return (
    <svg viewBox="0 0 21 21" className={`bg-white p-2 rounded-xl ${className}`}>
      {cells.map((on, i) => {
        const x = i % 21, y = Math.floor(i / 21)
        const inFinder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)
        return on && !inFinder ? <rect key={i} x={x} y={y} width="1" height="1" fill="#111" /> : null
      })}
      {finder(0, 0)}{finder(14, 0)}{finder(0, 14)}
    </svg>
  )
}

export function PageHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-20">
      {onBack && (
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">←</button>
      )}
      <h1 className="font-bold text-gray-900 flex-1 truncate">{title}</h1>
      {right}
    </div>
  )
}

export function KpiCard({ label, value, sub, subColor = 'text-gray-400' }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
    </Card>
  )
}
