import logging
import os
import threading
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from dongle import DEVICE_ID, METER_ID, meter_state, start_mqtt_loop_in_background

log = logging.getLogger("mock-dongle.api")

BACKEND_HEARTBEAT_URL = os.getenv(
    "BACKEND_HEARTBEAT_URL", f"http://localhost:8080/api/v1/devices/{DEVICE_ID}/heartbeat"
)
HEARTBEAT_INTERVAL_SECONDS = int(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "15"))
SEND_HEARTBEAT = os.getenv("SEND_HEARTBEAT", "true").lower() == "true"


def _heartbeat_loop():
    """Simule §07_Firmware telemetry_task: heartbeat périodique -> base d'ALG-03."""
    while True:
        try:
            with httpx.Client(timeout=3.0) as client:
                client.post(BACKEND_HEARTBEAT_URL)
        except httpx.HTTPError:
            pass  # PoC: le backend peut ne pas encore être démarré, on ne bloque pas la boucle.
        time.sleep(HEARTBEAT_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_mqtt_loop_in_background()
    if SEND_HEARTBEAT:
        threading.Thread(target=_heartbeat_loop, daemon=True).start()
    yield


app = FastAPI(title="CIE Smart Prepaid - Mock Dongle", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "UP", "deviceId": DEVICE_ID, "meterId": METER_ID}


@app.get("/meters/{meter_id}/status")
def meter_status(meter_id: str):
    # PoC: un seul meter simulé par instance de mock-dongle (meter_id attendu = METER_ID).
    return {"online": meter_state.online, "state": "READY" if meter_state.online else "OFFLINE"}


@app.get("/meters/{meter_id}/credit")
def meter_credit(meter_id: str):
    return {"creditFcfa": meter_state.credit_fcfa}
