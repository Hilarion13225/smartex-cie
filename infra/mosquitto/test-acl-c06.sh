#!/bin/sh
# ============================================================================
# test-acl-c06.sh
#
# Test de sécurité C06 (docs/02_developer-pack-poc.md §18_CyberTests) :
# "Broker ACL -> topics non autorisés inaccessibles." Complémentaire à C02
# (test-acl-c02.sh, qui compare deux devices légitimes entre eux) : ici,
# l'identité testée n'est PAS backend-gateway ni un device enregistré --
# c'est un certificat mTLS VALIDE (signé par la vraie CA de laboratoire,
# donc le handshake TLS réussit) mais dont le CN n'apparaît dans aucune
# règle explicite de acl.conf.
#
# Vérifie que ce client ("INTRUDER-0001") :
#   a) ne peut PAS s'abonner au topic de commande de DONGLE-LAB-0001 ;
#   b) ne peut PAS publier sur le topic d'ACK de DONGLE-LAB-0001 ;
#   c) ne peut RIEN recevoir via un abonnement wildcard cie/lab/#.
#
# Observation documentée (PAS un échec de ce test) : la règle `pattern` de
# acl.conf étant générique (s'applique à toute identité authentifiée, pas à
# une liste de devices enregistrés), ce même client INTRUDER-0001 obtient de
# façon standard un accès à SON PROPRE topic auto-scopé
# (cie/lab/INTRUDER-0001/...) -- exactement comme n'importe quel certificat
# valide émis par la CA de labo. Ce n'est pas une brèche vers les données
# d'un AUTRE device (ce que ce test vérifie), mais un trait d'architecture à
# connaître : la sécurité repose sur le contrôle de l'émission des
# certificats (PKI), pas sur une liste blanche de devices connus du broker.
#
# Prérequis : `docker compose up` déjà lancé, certs de labo déjà générés.
# openssl disponible localement pour générer le certificat INTRUDER-0001
# (signé par la vraie CA de labo -- clé privée jetable, jamais commitée).
#
# Usage: sh infra/mosquitto/test-acl-c06.sh
# ============================================================================
set -eu

# Voir test-cert-invalide-t11-c01.sh pour l'explication de MSYS_NO_PATHCONV
# (Git Bash/Windows uniquement) et pourquoi on `cd` dans un répertoire jetable
# avec des noms de fichiers relatifs.
export MSYS_NO_PATHCONV=1

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CERTS_DIR="$SCRIPT_DIR/certs"
NETWORK="${COMPOSE_NETWORK:-cie-smart-prepaid-poc_default}"
IMAGE="eclipse-mosquitto:2"
# Voir test-cert-invalide-t11-c01.sh : /tmp par défaut n'est généralement pas
# partagé avec Docker Desktop sous Windows, d'où un répertoire jetable sous $HOME.
INTRUDER_DIR=$(mktemp -d "$HOME/.tmp-c06.XXXXXX")
trap 'rm -rf "$INTRUDER_DIR"' EXIT
MARKER="C06-ne-doit-jamais-etre-recu-$$"
FAIL=0

echo "== [0/4] Génération du certificat INTRUDER-0001 (signé par la VRAIE CA de labo, CN inconnu de acl.conf) =="
# genpkey/req -subj: MSYS_NO_PATHCONV doit être ACTIF (protège "/O=...").
( cd "$INTRUDER_DIR" \
  && openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out intruder.key >/dev/null 2>&1 \
  && openssl req -new -key intruder.key \
       -subj "/O=SMARTEX-CIE-Lab/OU=PoC-Laboratoire/CN=INTRUDER-0001" \
       -out intruder.csr >/dev/null 2>&1 )
# x509 -CA/-CAkey: chemins réels absolus vers la CA de labo -- MSYS_NO_PATHCONV doit
# au contraire être DÉSACTIVÉ ici pour qu'ils soient résolus correctement.
( cd "$INTRUDER_DIR" \
  && unset MSYS_NO_PATHCONV \
  && openssl x509 -req -in intruder.csr -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" \
       -CAcreateserial -days 1 -sha256 -out intruder.crt >/dev/null 2>&1 )

mqtt_pub() {
  docker run --rm --network "$NETWORK" -v "$CERTS_DIR:/lab:ro" -v "$INTRUDER_DIR:/intruder:ro" "$IMAGE" \
    mosquitto_pub -h mosquitto -p 8883 --cafile /lab/ca.crt --cert "$1" --key "$2" -t "$3" -m "$4"
}
mqtt_sub_bg() {
  docker run --rm --network "$NETWORK" -v "$CERTS_DIR:/lab:ro" -v "$INTRUDER_DIR:/intruder:ro" "$IMAGE" \
    mosquitto_sub -h mosquitto -p 8883 --cafile /lab/ca.crt --cert "$1" --key "$2" -t "$3" -C 1 -W 6 > "$4" 2>&1 &
}

echo
echo "== [1/4] C06.a: INTRUDER-0001 tente de s'abonner à la commande de DONGLE-LAB-0001 =="
OUT1=$(mktemp)
mqtt_sub_bg "/intruder/intruder.crt" "/intruder/intruder.key" "cie/lab/DONGLE-LAB-0001/command/token" "$OUT1"
sleep 1
mqtt_pub "/lab/backend-gateway.crt" "/lab/backend-gateway.key" "cie/lab/DONGLE-LAB-0001/command/token" "{\"probe\":\"$MARKER\"}"
sleep 6
cat "$OUT1"
if grep -q "$MARKER" "$OUT1"; then
  echo "ECHEC C06.a: INTRUDER-0001 a reçu la commande de DONGLE-LAB-0001."
  FAIL=1
else
  echo "OK C06.a: accès refusé."
fi
rm -f "$OUT1"

echo
echo "== [2/4] C06.b: INTRUDER-0001 tente de publier sur l'ACK de DONGLE-LAB-0001 =="
OUT2=$(mktemp)
mqtt_sub_bg "/lab/backend-gateway.crt" "/lab/backend-gateway.key" "cie/lab/DONGLE-LAB-0001/ack" "$OUT2"
sleep 1
mqtt_pub "/intruder/intruder.crt" "/intruder/intruder.key" "cie/lab/DONGLE-LAB-0001/ack" "{\"result\":\"$MARKER\"}" || true
sleep 6
cat "$OUT2"
if grep -q "$MARKER" "$OUT2"; then
  echo "ECHEC C06.b: la publication d'INTRUDER-0001 a été relayée."
  FAIL=1
else
  echo "OK C06.b: publication refusée."
fi
rm -f "$OUT2"

echo
echo "== [3/4] C06.c: INTRUDER-0001 tente un abonnement wildcard cie/lab/# =="
OUT3=$(mktemp)
mqtt_sub_bg "/intruder/intruder.crt" "/intruder/intruder.key" "cie/lab/#" "$OUT3"
sleep 1
mqtt_pub "/lab/backend-gateway.crt" "/lab/backend-gateway.key" "cie/lab/DONGLE-LAB-0001/command/token" "{\"probe\":\"$MARKER-wild\"}"
sleep 6
cat "$OUT3"
if grep -q "$MARKER-wild" "$OUT3"; then
  echo "ECHEC C06.c: INTRUDER-0001 a reçu via l'abonnement wildcard."
  FAIL=1
else
  echo "OK C06.c: abonnement wildcard sans effet (rien reçu d'un topic d'un autre device)."
fi
rm -f "$OUT3"

echo
echo "== [4/4] Observation documentée (pas un critère d'échec) : accès de INTRUDER-0001 à SON PROPRE topic =="
OUT4=$(mktemp)
mqtt_sub_bg "/intruder/intruder.crt" "/intruder/intruder.key" "cie/lab/INTRUDER-0001/command/token" "$OUT4"
sleep 1
mqtt_pub "/lab/backend-gateway.crt" "/lab/backend-gateway.key" "cie/lab/INTRUDER-0001/command/token" "{\"probe\":\"$MARKER-own\"}"
sleep 6
cat "$OUT4"
if grep -q "$MARKER-own" "$OUT4"; then
  echo "OBSERVATION: INTRUDER-0001 reçoit bien sur son propre topic auto-scopé (règle 'pattern'"
  echo "générique de acl.conf, appliquée à toute identité authentifiée -- voir en-tête de ce script)."
else
  echo "OBSERVATION: rien reçu, même sur son propre topic (à noter si inattendu)."
fi
rm -f "$OUT4"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "C06: PASS -- aucun accès aux topics d'un AUTRE device (DONGLE-LAB-0001) ni via wildcard."
  exit 0
else
  echo "C06: FAIL -- voir les échecs ci-dessus."
  exit 1
fi
