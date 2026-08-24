"""
Payment Simulator (§09_PaymentSimulator du Developer Pack).

But: isoler la preuve technique de paiement, sans transaction financière réelle.
Entrée: meterId, amountXof, currency. Sortie: transactionId, SUCCESS, timestamp.

Par défaut, transfère aussi le résultat au backend PoC via
POST /api/v1/payments/callback (comportement d'un vrai PSP après confirmation),
pour fermer la boucle T01 automatiquement.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

BACKEND_CALLBACK_URL = os.getenv(
    "BACKEND_CALLBACK_URL", "http://localhost:8080/api/v1/payments/callback"
)
FORWARD_TO_BACKEND = os.getenv("FORWARD_TO_BACKEND", "true").lower() == "true"

app = FastAPI(title="CIE Smart Prepaid - Payment Simulator", version="0.1.0")


class SimulatePaymentRequest(BaseModel):
    meter_id: str = Field(..., alias="meterId")
    customer_id: str = Field(..., alias="customerId")
    amount_xof: float = Field(..., alias="amountXof", gt=0)
    currency: str = "XOF"
    # Permet aux tests d'injecter un échec volontaire (T-négatif).
    force_status: Literal["SUCCESS", "FAILED"] = Field("SUCCESS", alias="forceStatus")

    model_config = ConfigDict(populate_by_name=True)


class SimulatePaymentResponse(BaseModel):
    transaction_id: str = Field(..., alias="transactionId")
    status: str
    timestamp: str

    model_config = ConfigDict(populate_by_name=True)


@app.get("/health")
def health():
    return {"status": "UP"}


@app.post("/simulate-payment", response_model=SimulatePaymentResponse)
def simulate_payment(request: SimulatePaymentRequest):
    """Règle: aucune vraie transaction financière (§09_PaymentSimulator)."""
    transaction_id = f"SIM-{uuid.uuid4()}"
    timestamp = datetime.now(timezone.utc).isoformat()
    status = request.force_status

    if FORWARD_TO_BACKEND:
        callback_payload = {
            "meterId": request.meter_id,
            "customerId": request.customer_id,
            "provider": "PAYMENT_SIMULATOR",
            "providerTxId": transaction_id,
            "amountXof": request.amount_xof,
            "status": status,
        }
        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(BACKEND_CALLBACK_URL, json=callback_payload)
        except httpx.HTTPError as exc:
            # Le PoC ne doit pas planter si le backend n'est pas encore démarré ;
            # on renvoie quand même la confirmation de paiement simulé.
            raise HTTPException(
                status_code=502,
                detail=f"Paiement simulé OK mais callback backend impossible: {exc}",
            ) from exc

    return SimulatePaymentResponse(transactionId=transaction_id, status=status, timestamp=timestamp)
