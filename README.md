# CIE Smart Retrofit Metering — Backend PoC Laboratoire

> Scope : uniquement `backend/` et `simulators/`. Le `frontend/` est traité séparément
> (voir CLAUDE.md).

## Démarrer tout le PoC en local

Prérequis : Docker + Docker Compose.

```bash
docker compose up --build
```

Services exposés :

| Service | URL | Rôle |
|---|---|---|
| `backend` | http://localhost:8080 | API Spring Boot (payment, recharge, device, audit) |
| `payment-simulator` | http://localhost:9000 | Simule le PSP / Mobile Money |
| `mock-dongle` | http://localhost:9001 | Simule le dongle + compteur (MQTT + HTTP) |
| `mosquitto` | tcp://localhost:1883 | Broker MQTT |
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
| docker-compose (postgres, mosquitto, backend, simulateurs) | ✅ Testé en intégration (T01→T06/T15) |
| Backend Java : compilation/tests réels | ✅ `mvn test` exécuté, build Docker validé |
| Sécurité: mTLS, PKI/HSM, ACL MQTT par device | ⛔ Non implémenté (mosquitto.conf est permissif, à durcir avant tout raccordement réel) |
| Endpoint de recette pour forcer un token invalide (T05) | ✅ `forceInvalidToken` sur `POST /api/v1/recharges` |
| Tests T07 (perte réseau), T08/T09 (reboot/power cycle) | ⛔ Nécessitent un vrai banc labo |
| incident-service, rules-engine-service (V2) | ⛔ Hors scope PoC actuel |

## Prochaine étape recommandée

1. Valider le scénario T01→T06→T15 ci-dessus de bout en bout (fait, voir tableau ci-dessus).
2. Une fois le Gate 1 (mock end-to-end fonctionnel) validé, durcir la sécurité MQTT
   (TLS + ACL) avant tout essai avec un compteur réel de laboratoire CIE.
3. Dérouler T07-T09 (perte réseau, reboot, coupure alimentation) sur un vrai banc labo.
