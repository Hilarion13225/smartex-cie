#!/bin/sh
# ============================================================================
# test-acl-c02.sh
#
# Test de sécurité C02 (docs/02_developer-pack-poc.md §18_CyberTests):
# "Dongle A tente une commande vers compteur B -> rejet." Vérifie, avec le
# VRAI certificat mTLS de DONGLE-LAB-0001 (pas un mock applicatif), que le
# rejet est appliqué par l'ACL du broker mosquitto (infra/mosquitto/acl.conf)
# et non par une règle métier du backend -- le backend n'est même pas
# impliqué dans ce test.
#
# Vérifie que DONGLE-LAB-0001:
#   a) ne peut PAS s'abonner au topic de commande d'un AUTRE device
#      (cie/lab/DONGLE-LAB-0002/command/token) ;
#   b) ne peut PAS publier sur le topic d'ACK d'un AUTRE device
#      (cie/lab/DONGLE-LAB-0002/ack).
#
# Méthode: un message TÉMOIN est publié/écouté via le certificat
# backend-gateway (légitimement autorisé sur cie/lab/+/... par acl.conf) ;
# le test échoue si DONGLE-LAB-0001 parvient à le recevoir/injecter malgré
# tout (preuve que l'ACL a une faille), et réussit s'il ne reçoit rien
# (timeout = accès refusé par le broker).
#
# Prérequis: `docker compose up` déjà lancé (service mosquitto up, certs
# générés par generate-lab-certs.sh). DONGLE-LAB-0002 n'a pas besoin d'exister
# en base : ce test porte uniquement sur le broker MQTT.
#
# Usage: sh infra/mosquitto/test-acl-c02.sh
# ============================================================================
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CERTS_DIR="$SCRIPT_DIR/certs"
NETWORK="${COMPOSE_NETWORK:-cie-smart-prepaid-poc_default}"
IMAGE="eclipse-mosquitto:2"
FOREIGN_DEVICE="DONGLE-LAB-0002"
MARKER="C02-ne-doit-jamais-etre-recu-$$"
FAIL=0

mqtt_pub() {
  # $1 = identité (nom de fichier cert/key sans extension), $2 = topic, $3 = payload
  docker run --rm --network "$NETWORK" -v "$CERTS_DIR:/certs:ro" "$IMAGE" \
    mosquitto_pub -h mosquitto -p 8883 --cafile /certs/ca.crt \
    --cert "/certs/$1.crt" --key "/certs/$1.key" -t "$2" -m "$3"
}

# Lance mosquitto_sub en tâche de fond (timeout 8s ou 1 message reçu),
# écrit la sortie dans $3, et affiche le PID à attendre avec `wait`.
mqtt_sub_bg() {
  # $1 = identité, $2 = topic, $3 = fichier de sortie
  docker run --rm --network "$NETWORK" -v "$CERTS_DIR:/certs:ro" "$IMAGE" \
    mosquitto_sub -h mosquitto -p 8883 --cafile /certs/ca.crt \
    --cert "/certs/$1.crt" --key "/certs/$1.key" -t "$2" -C 1 -W 8 > "$3" 2>&1 &
  echo $!
}

echo "== C02.a: DONGLE-LAB-0001 tente de s'abonner à la commande d'un AUTRE device =="
OUT1=$(mktemp)
PID1=$(mqtt_sub_bg "DONGLE-LAB-0001" "cie/lab/${FOREIGN_DEVICE}/command/token" "$OUT1")
sleep 1
# Message témoin publié par backend-gateway, légitime selon l'ACL (write cie/lab/+/command/token).
mqtt_pub "backend-gateway" "cie/lab/${FOREIGN_DEVICE}/command/token" "{\"probe\":\"${MARKER}\"}"
wait "$PID1" || true
cat "$OUT1"
if grep -q "$MARKER" "$OUT1"; then
  echo "ECHEC C02.a: DONGLE-LAB-0001 a reçu la commande d'un autre device (ACL non appliquée)."
  FAIL=1
else
  echo "OK C02.a: DONGLE-LAB-0001 n'a rien reçu du topic de commande d'un autre device (ACL appliquée)."
fi
rm -f "$OUT1"

echo
echo "== C02.b: DONGLE-LAB-0001 tente de publier sur l'ACK d'un AUTRE device =="
OUT2=$(mktemp)
PID2=$(mqtt_sub_bg "backend-gateway" "cie/lab/${FOREIGN_DEVICE}/ack" "$OUT2")
sleep 1
# DONGLE-LAB-0001 tente de publier sur l'ACK d'un device qui n'est pas le sien.
mqtt_pub "DONGLE-LAB-0001" "cie/lab/${FOREIGN_DEVICE}/ack" "{\"result\":\"${MARKER}\"}" || true
wait "$PID2" || true
cat "$OUT2"
if grep -q "$MARKER" "$OUT2"; then
  echo "ECHEC C02.b: le message publié par DONGLE-LAB-0001 sur l'ACK d'un autre device a été relayé (ACL non appliquée)."
  FAIL=1
else
  echo "OK C02.b: la publication de DONGLE-LAB-0001 sur l'ACK d'un autre device a été rejetée/ignorée (ACL appliquée)."
fi
rm -f "$OUT2"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "C02: PASS -- isolation par device correctement appliquée par l'ACL du broker mosquitto."
  exit 0
else
  echo "C02: FAIL -- voir les échecs ci-dessus."
  exit 1
fi
