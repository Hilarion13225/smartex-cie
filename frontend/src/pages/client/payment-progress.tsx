import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../../stores/app'
import { FullScreenLoader } from '../../components/ui'
import { fcfaToKwh, MOCK_TARIFF_FCFA_PER_KWH } from '../../types'

const operatorLogos: Record<string, string> = {
  WAVE: '/logos/wave-logo.jpg',
  ORANGE_MONEY: '/logos/orangemoney-logo.jpg',
  MTN_MONEY: '/logos/mtn-logo.jpg',
  MOOV_MONEY: '/logos/moov-logo.jpg',
}

export function PaymentProgressPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [progress, setProgress] = useState(0)
  const { notify } = useAppStore()
  const operator = searchParams.get('operator') || 'WAVE'
  const amount = parseInt(searchParams.get('amount') || '5000')
  const amountKwh = fcfaToKwh(amount)
  const creditBefore = 1500 // Mock crédit avant paiement
  const creditAfter = creditBefore + amount

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 33 && p < 34) {
          notify('Paiement confirmé', `${amount} FCFA reçu par ${operator}`, 'SUCCESS')
        }
        if (p >= 66 && p < 67) {
          notify('Token généré', `Token TK-${Date.now().toString().slice(-6)} prêt`, 'INFO')
        }
        if (p >= 100) {
          clearInterval(interval)
          notify('Crédit appliqué', `+${amountKwh.toFixed(1)} kWh sur votre compteur`, 'SUCCESS')
          setTimeout(() => navigate('/app'), 2000)
          return 100
        }
        return p + Math.random() * 30
      })
    }, 500)
    return () => clearInterval(interval)
  }, [navigate, notify, amount, amountKwh])

  return (
    <div className="min-h-full max-w-md mx-auto bg-white flex flex-col px-6 py-10">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
        <img
          src={operatorLogos[operator] || '/logos/wave-logo.jpg'}
          alt={operator}
          className="h-20 w-20 object-contain"
        />

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paiement en cours</h1>
          <p className="text-sm text-gray-500 mt-2">Via {operator}</p>
        </div>

        <div className="w-full">
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-cie-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">{Math.round(Math.min(progress, 100))}%</p>
        </div>

        <div className="w-full space-y-3">
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <p className="text-xs text-orange-600 font-semibold">Montant</p>
            <p className="text-2xl font-bold text-orange-700 mt-1">{amount.toLocaleString("fr-FR")} FCFA</p>
            <p className="text-xs text-orange-500 mt-1">≈ {amountKwh.toFixed(1)} kWh</p>
          </div>

          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <p className="text-xs text-green-600 font-semibold">Crédits</p>
            <div className="flex items-center justify-between mt-2">
              <div>
                <p className="text-xs text-green-500">Avant</p>
                <p className="font-bold text-green-700">{creditBefore.toLocaleString("fr-FR")} FCFA</p>
              </div>
              <span className="text-lg text-green-600">+</span>
              <div>
                <p className="text-xs text-green-500">Recharge</p>
                <p className="font-bold text-green-700">{amount.toLocaleString("fr-FR")} FCFA</p>
              </div>
              <span className="text-lg text-green-600">=</span>
              <div>
                <p className="text-xs text-green-500">Après</p>
                <p className="font-bold text-green-700">{creditAfter.toLocaleString("fr-FR")} FCFA</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p style={{ color: progress >= 33 ? '#16a34a' : '#9ca3af' }}>✓ Paiement confirmé</p>
          <p style={{ color: progress >= 66 ? '#16a34a' : '#9ca3af' }}>✓ Token généré</p>
          <p style={{ color: progress >= 100 ? '#16a34a' : '#9ca3af' }}>✓ Crédit appliqué</p>
        </div>
      </div>

      {progress === 100 && (
        <div className="text-center text-xs text-gray-400">
          Redirection vers CIE...
        </div>
      )}
    </div>
  )
}
