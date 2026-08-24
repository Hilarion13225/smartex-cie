import os

os.environ["FORWARD_TO_BACKEND"] = "false"  # pas de backend démarré pendant ce test unitaire

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "UP"


def test_simulate_payment_nominal_T01():
    payload = {
        "meterId": "CIE-LAB-0001",
        "customerId": "CUST-1",
        "amountXof": 5000,
        "currency": "XOF",
    }
    resp = client.post("/simulate-payment", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "SUCCESS"
    assert body["transactionId"].startswith("SIM-")
    assert "timestamp" in body


def test_simulate_payment_force_failed():
    payload = {
        "meterId": "CIE-LAB-0001",
        "customerId": "CUST-1",
        "amountXof": 5000,
        "forceStatus": "FAILED",
    }
    resp = client.post("/simulate-payment", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "FAILED"


def test_rejects_non_positive_amount():
    payload = {"meterId": "CIE-LAB-0001", "customerId": "CUST-1", "amountXof": 0}
    resp = client.post("/simulate-payment", json=payload)
    assert resp.status_code == 422
