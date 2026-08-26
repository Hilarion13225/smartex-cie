import { useNavigate } from 'react-router-dom'
import { useRechargeStore } from '../../stores/recharge'
import { Button, PageHeader } from '../../components/ui'
import { fmtFcfa } from '../../types'

export function PaymentErrorPage() {
  const navigate = useNavigate()
  const { recharge, amount } = useRechargeStore()

  if (!recharge) {
    navigate('/app/recharge')
    return null
  }

  return (
    <div className="min-h-full max-w-md mx-auto bg-white flex flex-col">
      <PageHeader title="Erreur de paiement" onBack={() => navigate(-1)} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6">
        <span className="text-6xl">❌</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Paiement échoué</h2>
          <p className="text-sm text-gray-500 mt-2">Impossible de valider votre transaction</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 w-full text-left">
          <p className="text-xs text-red-600 font-semibold mb-2">Détails</p>
          <div className="space-y-1 text-xs text-red-700">
            <p>• Montant: <b>{fmtFcfa(amount)}</b></p>
            <p>• Référence: <b>{recharge.rechargeId}</b></p>
            <p>• Raison: Validation échouée (simulation)</p>
          </div>
        </div>

        <div className="text-sm text-gray-500">
          <p>Aucun montant n'a été débité de votre compte.</p>
        </div>

        <div className="w-full space-y-2">
          <Button
            onClick={() => navigate('/app/recharge')}
            className="w-full"
          >
            Réessayer
          </Button>
          <Button
            onClick={() => navigate('/app')}
            variant="secondary"
            className="w-full"
          >
            Retour
          </Button>
        </div>
      </div>
    </div>
  )
}
