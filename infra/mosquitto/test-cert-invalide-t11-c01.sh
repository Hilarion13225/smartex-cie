#!/bin/sh
# ============================================================================
# test-cert-invalide-t11-c01.sh
#
# Test de sécurité T11 / C01 (docs/02_developer-pack-poc.md §14_TestMatrix et
# §18_CyberTests) : "Certificat/identité invalide -> rejet." Génère à la volée
# un certificat client signé par une CA "rogue" (différente de la CA de
# laboratoire configurée dans mosquitto.conf), avec un CN identique à un
# device légitime (DONGLE-LAB-0001) -- pour prouver que c'est bien la chaîne
# de confiance qui est vérifiée, pas seulement le nom.
#
# Vérifie que mosquitto refuse la connexion TLS AVANT même le niveau MQTT
# (donc avant toute authentification applicative/ACL) : le handshake échoue
# avec "certificate verify failed" côté broker.
#
# Prérequis : `docker compose up` déjà lancé (service mosquitto up, certs de
# labo déjà générés par generate-lab-certs.sh). openssl disponible localement,
# ou exécuter ce script via le même conteneur Alpine que generate-lab-certs.sh
# (voir son en-tête pour la commande Docker équivalente).
#
# Usage: sh infra/mosquitto/test-cert-invalide-t11-c01.sh
# ============================================================================
set -eu

# MSYS_NO_PATHCONV: nécessaire sous Git Bash / MSYS (Windows) pour que -subj
# "/O=..." ne soit pas réinterprété comme un chemin de fichier. Sans effet
# ailleurs (Linux/macOS). Combiné à un `cd` dans un répertoire jetable et à
# des noms de fichiers relatifs (jamais de chemin commençant par "/") pour
# qu'openssl continue de résoudre correctement les fichiers malgré cette
# variable -- voir la note dans le commit qui a introduit ce script.
export MSYS_NO_PATHCONV=1

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
LAB_CERTS_DIR="$SCRIPT_DIR/certs"
NETWORK="${COMPOSE_NETWORK:-cie-smart-prepaid-poc_default}"
IMAGE="eclipse-mosquitto:2"
# Sous Docker Desktop pour Windows, seuls certains chemins hôte (typiquement sous
# %USERPROFILE%) sont partagés avec le moteur Docker -- le $TMPDIR par défaut
# (/tmp) ne l'est généralement pas et provoquerait un montage silencieusement
# vide ("File not found" côté mosquitto_pub). On force donc un répertoire
# jetable sous $HOME plutôt que de laisser mktemp choisir /tmp.
ROGUE_DIR=$(mktemp -d "$HOME/.tmp-t11-c01.XXXXXX")
trap 'rm -rf "$ROGUE_DIR"' EXIT
cd "$ROGUE_DIR"

echo "== [1/2] Génération d'un certificat client signé par une CA ROGUE (CN=DONGLE-LAB-0001, mais PAS la CA de labo) =="
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out rogue-ca.key >/dev/null 2>&1
openssl req -x509 -new -key rogue-ca.key -sha256 -days 1 \
  -subj "/O=Rogue-Attacker/OU=Not-CIE-Lab/CN=Rogue-CA" \
  -out rogue-ca.crt >/dev/null 2>&1
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out rogue-client.key >/dev/null 2>&1
openssl req -new -key rogue-client.key \
  -subj "/O=Rogue-Attacker/OU=Not-CIE-Lab/CN=DONGLE-LAB-0001" \
  -out rogue-client.csr >/dev/null 2>&1
openssl x509 -req -in rogue-client.csr -CA rogue-ca.crt -CAkey rogue-ca.key \
  -CAcreateserial -days 1 -sha256 -out rogue-client.crt >/dev/null 2>&1
echo "Certificat rogue généré (jetable, jamais écrit dans le repo)."

echo
echo "== [2/2] Tentative de connexion MQTT avec ce certificat rogue vers mosquitto:8883 =="
set +e
OUTPUT=$(docker run --rm --network "$NETWORK" \
  -v "$LAB_CERTS_DIR:/lab:ro" -v "$ROGUE_DIR:/rogue:ro" "$IMAGE" \
  mosquitto_pub -h mosquitto -p 8883 --cafile /lab/ca.crt \
  --cert /rogue/rogue-client.crt --key /rogue/rogue-client.key \
  -t cie/lab/DONGLE-LAB-0001/ack -m '{"probe":"T11-rogue-cert"}' -d 2>&1)
RC=$?
set -e
echo "$OUTPUT"

if [ $RC -ne 0 ] && echo "$OUTPUT" | grep -qi "unknown ca\|certificate verify failed\|certificate_unknown\|bad certificate"; then
  echo
  echo "T11/C01: PASS -- la connexion a été refusée par mosquitto (échec du handshake TLS,"
  echo "certificat non signé par la CA de laboratoire), avant toute authentification MQTT."
  exit 0
else
  echo
  echo "T11/C01: FAIL -- la connexion avec un certificat rogue n'a pas été rejetée comme attendu."
  exit 1
fi
