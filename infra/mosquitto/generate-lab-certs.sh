#!/bin/sh
# ============================================================================
# generate-lab-certs.sh
#
# Genere une PKI de LABORATOIRE (CA auto-signee + certificat serveur mosquitto
# + certificats clients mTLS) pour le PoC CIE Smart Prepaid, conformement a
# docs/02_developer-pack-poc.md §10_MQTT et §12_Securite (mTLS + identite par
# certificat, l'ACL du broker se base ensuite sur le CN de chaque certificat).
#
# ATTENTION - CERTIFICATS DE DEVELOPPEMENT / LABORATOIRE UNIQUEMENT:
#   - CA auto-signee (pas de chaine de confiance tierce), cles privees
#     generees et stockees EN CLAIR sur disque (pas de HSM/secure element).
#   - Pas de rotation, pas de revocation (aucune CRL/OCSP).
#   - A regenerer pour chaque environnement de labo (voir option ci-dessous).
#   - JAMAIS a reutiliser en pre-production ou en production CIE. Tout
#     raccordement a un compteur/dongle reel DOIT passer par la PKI approuvee
#     par la Cybersecurite CIE, pas par ce script.
#
# Usage:
#   sh infra/mosquitto/generate-lab-certs.sh
#
# Si openssl n'est pas installe sur la machine hote, executer via Docker:
#   docker run --rm -v "$(pwd)/infra/mosquitto:/work" -w /work alpine:3 \
#     sh -c "apk add --no-cache openssl && sh generate-lab-certs.sh"
#
# Sortie: infra/mosquitto/certs/ (exclu de Git via .gitignore -- ne jamais
# commiter ce dossier, il contient des cles privees).
# ============================================================================
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CERTS_DIR="$SCRIPT_DIR/certs"
DAYS_CA=3650
DAYS_LEAF=825

mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

echo "== [1/3] CA de laboratoire =="
if [ ! -f ca.crt ]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out ca.key
  openssl req -x509 -new -key ca.key -sha256 -days "$DAYS_CA" \
    -subj "/O=SMARTEX-CIE-Lab/OU=PoC-Laboratoire/CN=CIE-Lab-CA" \
    -out ca.crt
  echo "CA generee: ca.crt / ca.key"
else
  echo "CA existante reutilisee (supprimer certs/ca.* pour regenerer toute la PKI de labo)"
fi

echo "== [2/3] Certificat serveur (mosquitto) =="
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out server.key
openssl req -new -key server.key \
  -subj "/O=SMARTEX-CIE-Lab/OU=PoC-Laboratoire/CN=mosquitto" \
  -out server.csr
printf 'subjectAltName=DNS:mosquitto,DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days "$DAYS_LEAF" -sha256 -extfile server.ext -out server.crt
rm -f server.csr server.ext
echo "Certificat serveur genere: server.crt / server.key (CN=mosquitto)"

echo "== [3/3] Certificats clients mTLS (identite = CN, utilisee par l'ACL) =="
# CN doit correspondre exactement a l'identite attendue par infra/mosquitto/acl.conf
# et par DEVICE_ID (mock-dongle) / MQTT_CLIENT_ID (backend) dans docker-compose.yml.
for id in backend-gateway DONGLE-LAB-0001; do
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${id}.key"
  openssl req -new -key "${id}.key" \
    -subj "/O=SMARTEX-CIE-Lab/OU=PoC-Laboratoire/CN=${id}" \
    -out "${id}.csr"
  printf 'extendedKeyUsage=clientAuth\n' > "${id}.ext"
  openssl x509 -req -in "${id}.csr" -CA ca.crt -CAkey ca.key -CAcreateserial \
    -days "$DAYS_LEAF" -sha256 -extfile "${id}.ext" -out "${id}.crt"
  rm -f "${id}.csr" "${id}.ext"
  echo "Certificat client genere: ${id}.crt / ${id}.key (CN=${id})"
done

# NB: 644 (et non 600) car ces fichiers sont bind-montés dans des conteneurs
# qui les lisent sous un UID différent de celui de l'hôte (mosquitto, backend,
# mock-dongle) -- inoffensif ici (labo, cles jetables), mais a proscrire en
# dehors d'un contexte PoC.
chmod 644 ./*.key ./*.crt 2>/dev/null || true

cat <<'EOF'

============================================================================
 Certificats de LABORATOIRE generes dans infra/mosquitto/certs/.
 CA auto-signee, cles privees en clair sur disque, aucune rotation/CRL.
 JAMAIS a reutiliser en pre-production ou production CIE -- un raccordement
 a un compteur/dongle reel doit passer par la PKI approuvee par la
 Cybersecurite CIE (voir docs/02_developer-pack-poc.md §12_Securite).
 Ce dossier est exclu de Git (.gitignore) : ne jamais le commiter.
============================================================================
EOF
