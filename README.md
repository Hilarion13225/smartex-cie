# CIE Smart Retrofit Metering — Backend PoC Laboratoire

> Scope : uniquement `backend/` et `simulators/`. Le `frontend/` est traité séparément
> (voir CLAUDE.md).

## Démarrer tout le PoC en local

Prérequis : Docker + Docker Compose.

Le broker MQTT est durci en mTLS (§12_Securite) : **générer les certificats de
laboratoire avant le premier démarrage** (pas nécessaire ensuite, ils sont
réutilisés) :

```bash
sh infra/mosquitto/generate-lab-certs.sh
# Si openssl n'est pas installé sur la machine hôte, via Docker :
#   docker run --rm -v "$(pwd)/infra/mosquitto:/work" -w /work alpine:3 \
#     sh -c "apk add --no-cache openssl && sh generate-lab-certs.sh"

docker compose up --build
```

Services exposés :

| Service | URL | Rôle |
|---|---|---|
| `backend` | http://localhost:8080 | API Spring Boot (payment, recharge, device, audit) |
| `payment-simulator` | http://localhost:9000 | Simule le PSP / Mobile Money |
| `mock-dongle` | http://localhost:9001 | Simule le dongle + compteur (MQTT + HTTP) |
| `mosquitto` | ssl://localhost:8883 (mTLS) | Broker MQTT |
| `postgres` | localhost:5432 | Base de données (`poc_user` / `poc_password`) |

Un compteur/dongle de laboratoire (`CIE-LAB-0001` / `DONGLE-LAB-0001`) est pré-enregistré
via la migration Flyway `V2__seed_lab_device.sql`.

## Scénario de test manuel (T01 → T15)

### T01 — Paiement nominal + T02/T03/T04 — bout en bout automatique

```bash
curl -X POST http://localhost:9000/simulate-payment \
  -H "Content-Type: application/json" \
  -d '{"meterId":"CIE-LAB-0001","customerId":"CUST-1","amountXof":5000}'
```

Ceci déclenche automatiquement toute la chaîne : paiement confirmé → token généré →
commande publiée sur MQTT → mock-dongle applique le crédit → ACK `ACCEPTED` → recharge
au statut `CREDIT_APPLIED`.

Récupérer le `rechargeId` retourné par les logs backend, puis :

```bash
curl http://localhost:8080/api/v1/recharges/{rechargeId}
```

Le champ `finalStatus` doit valoir `CREDIT_APPLIED`, et la liste `commands` doit contenir
une commande au statut `ACCEPTED`.

### T05 — Token invalide → REJECTED

Le mock-dongle rejette tout token contenant le marqueur `INVALID` (voir `INVALID_TOKEN_MARKER`
dans `simulators/mock-dongle/dongle.py`). Pour déclencher ce cas en test manuel sans polluer
le flux nominal, `POST /api/v1/recharges` accepte un champ optionnel `forceInvalidToken`
(booléen, `false` par défaut) qui force la génération d'un token contenant ce marqueur au
lieu du token normal `LABTKN-...` :

```bash
curl -X POST http://localhost:8080/api/v1/recharges \
  -H "Content-Type: application/json" \
  -d '{"customerId":"CUST-1","meterId":"CIE-LAB-0001","amount":2000,"channel":"APP","idempotencyKey":"TEST-T05-1","forceInvalidToken":true}'
```

La commande passe par `SENT` puis reçoit un ACK `REJECTED` du mock-dongle ; vérifier via
`GET /api/v1/recharges/{rechargeId}` que `finalStatus` vaut `COMMAND_REJECTED` et que la
commande listée est au statut `REJECTED`. Un événement d'audit `COMMAND_REJECTED`
(`errorCode: TOKEN_REJECTED`) doit apparaître dans `GET /api/v1/audit?correlationId=...`.
Ce champ n'a aucun effet sur le flux nominal (paiement confirmé via `payment-simulator`) :
il n'existe que sur l'endpoint de recharge manuelle.

### T06 / T12 — Double commande / rejeu

Envoyer deux fois le même paiement simulé avec le **même `providerTxId`** (nécessite un
petit script, `providerTxId` est généré aléatoirement par défaut dans le simulateur) —
ou appeler `POST /api/v1/recharges` deux fois avec le même `idempotencyKey` :

```bash
curl -X POST http://localhost:8080/api/v1/recharges \
  -H "Content-Type: application/json" \
  -d '{"customerId":"CUST-1","meterId":"CIE-LAB-0001","amount":2000,"channel":"APP","idempotencyKey":"TEST-KEY-1"}'

# Rejouer exactement la même requête :
curl -X POST http://localhost:8080/api/v1/recharges \
  -H "Content-Type: application/json" \
  -d '{"customerId":"CUST-1","meterId":"CIE-LAB-0001","amount":2000,"channel":"APP","idempotencyKey":"TEST-KEY-1"}'
```

→ le second appel doit renvoyer le **même `rechargeId`**, et une seule commande doit avoir
été publiée sur MQTT (vérifiable via `GET /api/v1/recharges/{id}` : une seule entrée dans
`commands`).

### T15 — Auditabilité bout en bout

```bash
curl "http://localhost:8080/api/v1/audit?correlationId={correlationId}"
```

Le `correlationId` est renvoyé dans le header `X-Correlation-Id` de n'importe quelle
réponse du backend. La réponse doit lister, dans l'ordre chronologique, tous les
événements : `PAYMENT_CONFIRMED`, `RECHARGE_CREATED`, `COMMAND_SENT`, `CREDIT_APPLIED`.

### Statut compteur

```bash
curl http://localhost:8080/api/v1/meters/CIE-LAB-0001/status
```

## Sécurité MQTT (mTLS + ACL par device)

Conformément à docs/02_developer-pack-poc.md §10_MQTT / §12_Securite, le broker
mosquitto exige un certificat client (mTLS mutuel) et applique une ACL par device
dérivée du CN du certificat (`use_identity_as_username`, voir `infra/mosquitto/acl.conf`) :

- `backend-gateway` peut publier sur `cie/lab/+/command/token` et lire `cie/lab/+/ack`.
- Chaque dongle (ex. `DONGLE-LAB-0001`) ne peut lire que **son propre**
  `cie/lab/{deviceId}/command/token` et publier que sur **son propre**
  `cie/lab/{deviceId}/ack` — jamais les topics d'un autre device.

Certificats de laboratoire auto-signés générés par `infra/mosquitto/generate-lab-certs.sh`
(voir avertissement dans le script : **jamais à réutiliser en production**).

### C02 — Dongle A tente une commande vers compteur B → rejet par l'ACL

Test de sécurité concret : avec le **vrai certificat mTLS** de `DONGLE-LAB-0001`
(pas un mock applicatif), on vérifie que le broker — pas le code du backend — refuse
tout accès aux topics d'un autre device (`DONGLE-LAB-0002`, fictif : ce test ne
touche pas la base de données).

```bash
sh infra/mosquitto/test-acl-c02.sh
```

Le script effectue, via des conteneurs `eclipse-mosquitto:2` jetables sur le réseau
`docker compose` (`cie-smart-prepaid-poc_default`) :

1. `DONGLE-LAB-0001` s'abonne à `cie/lab/DONGLE-LAB-0002/command/token`, puis
   `backend-gateway` y publie un message témoin → le dongle ne doit **rien** recevoir
   (timeout `mosquitto_sub -W`).
2. `DONGLE-LAB-0001` tente de publier sur `cie/lab/DONGLE-LAB-0002/ack` pendant que
   `backend-gateway` écoute ce topic (légitime pour lui) → il ne doit **rien** recevoir.

Sortie attendue : `C02: PASS -- isolation par device correctement appliquée par
l'ACL du broker mosquitto.` (code de sortie 0). Pour rejouer manuellement une seule
étape (ex. la commande d'un autre device) :

```bash
docker run --rm --network cie-smart-prepaid-poc_default \
  -v "$(pwd)/infra/mosquitto/certs:/certs:ro" eclipse-mosquitto:2 \
  mosquitto_sub -h mosquitto -p 8883 --cafile /certs/ca.crt \
  --cert /certs/DONGLE-LAB-0001.crt --key /certs/DONGLE-LAB-0001.key \
  -t cie/lab/DONGLE-LAB-0002/command/token -C 1 -W 8
# -> doit rester bloqué puis afficher "Timed out" (aucun message reçu).
```

## Lancer les tests

### Backend Java (nécessite un accès réseau à Maven Central — pas fourni dans ce sandbox)

```bash
cd backend/poc-backend
mvn test
```

### Simulateurs Python (déjà exécutés et validés dans ce sandbox)

```bash
cd simulators/payment-simulator && pip install -r requirements.txt pytest && pytest -v
cd simulators/mock-dongle && pip install -r requirements.txt pytest && pytest -v
```

## Ce qui est fait vs. ce qui reste (statut au 24/08/2026)

| Élément | Statut |
|---|---|
| payment-service (callback, anti-double-paiement) | ✅ Code complet |
| recharge/token/command-service (idempotence, séquence, retry, fallback) | ✅ Code complet |
| device-service (registre, heartbeat, statut) | ✅ Code complet |
| audit-service (append-only, masquage token) | ✅ Code complet |
| mqtt-gateway (publish commande, écoute ACK) | ✅ Code complet |
| meter-adapter (interface + MockMeterAdapter HTTP) | ✅ Code complet |
| Migrations DB (schéma + seed) | ✅ Code complet |
| payment-simulator (Python) | ✅ Testé (4/4 tests passent) |
| mock-dongle (Python, MQTT + HTTP) | ✅ Testé (3/3 tests passent) |
| docker-compose (postgres, mosquitto, backend, simulateurs) | ✅ Testé en intégration (T01→T06/T15 + C02, avec mTLS actif) |
| Backend Java : compilation/tests réels | ✅ `mvn test` exécuté, build Docker validé |
| Sécurité: mTLS, ACL MQTT par device (certificats de labo) | ✅ Implémenté et testé (C02) — PKI/HSM réels restent à faire avant matériel CIE |
| Endpoint de recette pour forcer un token invalide (T05) | ✅ `forceInvalidToken` sur `POST /api/v1/recharges` |
| Tests T07 (perte réseau), T08/T09 (reboot/power cycle) | ⛔ Nécessitent un vrai banc labo |
| incident-service, rules-engine-service (V2) | ⛔ Hors scope PoC actuel |

## Prochaine étape recommandée

1. Qualifier le compteur/protocole réel avec la CIE (Gate 0) avant tout raccordement physique.
2. Remplacer la PKI de laboratoire auto-signée par la PKI approuvée par la Cybersécurité
   CIE (mTLS + ACL par device restent la même mécanique, seuls les certificats changent).
3. Étendre les tests de sécurité aux autres cas de `§18_CyberTests` (C01, C03-C07) sur le
   modèle de `infra/mosquitto/test-acl-c02.sh`.
4. Dérouler T07-T09 (perte réseau, reboot, coupure alimentation) sur un vrai banc labo.
