"""
Mock Dongle (§07_Firmware + §13_MeterAdapter du Developer Pack).

Simule, pour le PoC de laboratoire, le comportement du dongle STM32 + du
compteur : reçoit une commande de token authentifiée via MQTT, vérifie
l'anti-rejeu (même commandId déjà traité -> DUPLICATE), applique le crédit sur
un état en mémoire, et publie l'ACK métier. À remplacer par le vrai firmware +
compteur qualifié CIE en dehors du scope backend.
"""
import json
import logging
import os
import ssl
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import paho.mqtt.client as mqtt

logging.basicConfig(level=logging.INFO, format="%(asctime)s [mock-dongle] %(levelname)s %(message)s")
log = logging.getLogger("mock-dongle")

DEVICE_ID = os.getenv("DEVICE_ID", "DONGLE-LAB-0001")
METER_ID = os.getenv("METER_ID", "CIE-LAB-0001")
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))

# mTLS (§12_Securite): identité = CN du certificat client, doit valoir DEVICE_ID
# pour matcher infra/mosquitto/acl.conf ("pattern ... cie/lab/%u/..."). Certificats
# de laboratoire générés par infra/mosquitto/generate-lab-certs.sh.
MQTT_CA_CERT_PATH = os.getenv("MQTT_CA_CERT_PATH", "/certs/ca.crt")
MQTT_CLIENT_CERT_PATH = os.getenv("MQTT_CLIENT_CERT_PATH", "/certs/DONGLE-LAB-0001.crt")
MQTT_CLIENT_KEY_PATH = os.getenv("MQTT_CLIENT_KEY_PATH", "/certs/DONGLE-LAB-0001.key")

COMMAND_TOPIC = f"cie/lab/{DEVICE_ID}/command/token"
ACK_TOPIC = f"cie/lab/{DEVICE_ID}/ack"

# Marqueur volontaire pour forcer un rejet en test (T05: token invalide).
INVALID_TOKEN_MARKER = "INVALID"

# T08 (redémarrage du dongle) : sans persistance, un redémarrage effaçait tout
# le crédit accumulé et la mémoire anti-rejeu (constaté en test : credit_fcfa
# retombait à 0 alors que les recharges restaient CREDIT_APPLIED côté backend,
# seul système de référence). Ce fichier reste un mock logiciel, pas un
# équivalent de la flash/secure element attendue d'un vrai firmware -- mais il
# se comporte désormais correctement à travers un `docker compose restart`.
STATE_FILE_PATH = os.getenv("STATE_FILE_PATH", "")


@dataclass
class MeterState:
    credit_fcfa: float = 0.0
    online: bool = True
    processed_command_ids: set = field(default_factory=set)
    state_file: Optional[Path] = field(default=None, repr=False, compare=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False, compare=False)

    def __post_init__(self):
        if self.state_file is not None:
            self._load()

    def _load(self) -> None:
        try:
            raw = self.state_file.read_text(encoding="utf-8")
        except FileNotFoundError:
            return
        except OSError as e:
            log.error("Lecture de l'état persistant impossible (%s), démarrage à vide: %s", self.state_file, e)
            return
        try:
            data = json.loads(raw)
            self.credit_fcfa = float(data.get("credit_fcfa", 0.0))
            self.processed_command_ids = set(data.get("processed_command_ids", []))
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            log.error("État persistant illisible (%s), démarrage à vide: %s", self.state_file, e)
            return
        log.info("État restauré depuis %s: credit_fcfa=%s, %d commande(s) déjà traitée(s)",
                  self.state_file, self.credit_fcfa, len(self.processed_command_ids))

    def _save(self) -> None:
        if self.state_file is None:
            return
        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = self.state_file.with_suffix(".tmp")
            tmp_path.write_text(
                json.dumps({
                    "credit_fcfa": self.credit_fcfa,
                    "processed_command_ids": sorted(self.processed_command_ids),
                }),
                encoding="utf-8",
            )
            tmp_path.replace(self.state_file)  # écriture atomique (même volume)
        except OSError as e:
            log.error("Écriture de l'état persistant impossible (%s): %s", self.state_file, e)

    def apply_token(self, command_id: str, amount_xof: float) -> str:
        """Retourne ACCEPTED, REJECTED ou DUPLICATE (T04/T05/T06/T12)."""
        with self._lock:
            if command_id in self.processed_command_ids:
                log.warning("Rejeu détecté pour commandId=%s -> DUPLICATE", command_id)
                return "DUPLICATE"
            self.processed_command_ids.add(command_id)
            self.credit_fcfa += amount_xof
            self._save()
            return "ACCEPTED"


meter_state = MeterState(state_file=Path(STATE_FILE_PATH) if STATE_FILE_PATH else None)


def on_connect(client, userdata, flags, reason_code, properties=None):
    log.info("Connecté au broker MQTT %s:%s (rc=%s)", MQTT_HOST, MQTT_PORT, reason_code)
    client.subscribe(COMMAND_TOPIC, qos=1)
    log.info("Abonné à %s", COMMAND_TOPIC)


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except json.JSONDecodeError:
        log.error("Payload MQTT illisible sur %s", msg.topic)
        return

    command_id = payload.get("commandId")
    correlation_id = payload.get("correlationId", "n/a")
    token = payload.get("token", "")
    amount_xof = float(payload.get("amountXof", 0) or 0)

    # NE JAMAIS logger `token` en clair (masquage), on ne logue que sa présence.
    log.info("Commande reçue commandId=%s correlationId=%s (token reçu, non loggé)", command_id, correlation_id)

    if INVALID_TOKEN_MARKER in token:
        result = "REJECTED"
    else:
        result = meter_state.apply_token(command_id, amount_xof)

    ack_payload = {
        "commandId": command_id,
        "correlationId": correlation_id,
        "result": result,
        "deviceId": DEVICE_ID,
        "meterId": METER_ID,
    }
    client.publish(ACK_TOPIC, json.dumps(ack_payload), qos=1, retain=False)
    log.info("ACK publié: commandId=%s result=%s", command_id, result)


def build_client() -> mqtt.Client:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"mock-dongle-{DEVICE_ID}")
    client.on_connect = on_connect
    client.on_message = on_message
    # mTLS: le broker exige un certificat client (require_certificate true) et
    # dérive l'identité ACL de son CN -- pas de user/mot de passe séparé.
    client.tls_set(
        ca_certs=MQTT_CA_CERT_PATH,
        certfile=MQTT_CLIENT_CERT_PATH,
        keyfile=MQTT_CLIENT_KEY_PATH,
        tls_version=ssl.PROTOCOL_TLSv1_2,
    )
    return client


def start_mqtt_loop_in_background() -> mqtt.Client:
    client = build_client()
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=30)
    thread = threading.Thread(target=client.loop_forever, daemon=True)
    thread.start()
    return client
