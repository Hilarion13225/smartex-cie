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

## Authentification (domaine customer/auth)

Conformément à `docs/05_reconciliation-api-frontend-backend.md` §8, `/api/v1/recharges`,
`/api/v1/commands/{id}/retry`, `/api/v1/audit` et `/api/v1/support/timeline` exigent
désormais un JWT (`Authorization: Bearer <token>`). Restent ouverts (flux système/support,
pas des clients navigateur) : `/api/v1/meters/**`, `/api/v1/payments/callback`,
`/api/v1/devices/**`, `/actuator/**`.

Mécanisme **OTP-only** (décision validée) : pas de mot de passe qui conditionne la
connexion. Le code OTP n'est pas envoyé par SMS réel — il est loggé en clair sur la
console du backend (`ConsoleOtpSender`, PoC uniquement).

```bash
# 1. Inscription (le mot de passe est stocké mais réservé à un usage futur, non utilisé ici)
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0700000001","displayName":"Test Client","password":"Test@1234"}'

# 2. Récupérer le code dans les logs backend :
docker compose logs backend --tail 5 | grep OTP-MOCK
#   [OTP-MOCK] Code de vérification pour 0700000001 : 862339 (...)

# 3. Vérifier le code -> obtient le JWT
curl -X POST http://localhost:8080/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0700000001","code":"862339"}'
#   {"verified":true,"customer":{...},"token":"eyJ..."}

# Pour un compte déjà inscrit : POST /api/v1/auth/login {"phoneNumber":"..."} déclenche
# un nouvel OTP (même étapes 2-3 ensuite) au lieu de /register.
```

Utiliser le `token` obtenu dans l'en-tête `Authorization: Bearer $TOKEN` pour tous les
appels `curl` protégés ci-dessous.

`POST /api/v1/auth/register` crée toujours un compte de rôle `CLIENT` (aucune inscription
self-service pour les rôles support). Pour la recette, un compte `CIE_OPERATOR` de
laboratoire est pré-provisionné par migration Flyway (`V4__seed_lab_operator.sql`,
téléphone `0700000099`) : obtenir un token opérateur suit exactement le même flux
login/OTP que ci-dessus, en partant de `POST /auth/login` au lieu de `/auth/register`
(le compte existe déjà).

**⚠️ Identifiants de laboratoire — ne jamais réutiliser tel quel hors de cet environnement
local.** Le numéro `0700000099` est fixe et documenté publiquement dans ce dépôt : ce n'est
pas un secret, seulement une valeur de test connue. Il n'y a en revanche **aucun raccourci
d'authentification** pour ce compte : la connexion passe par le même flux OTP aléatoire/
haché/à usage unique que n'importe quel compte `CLIENT` (vérifié end-to-end : code erroné
rejeté, bon code accepté une seule fois, rejeu du même code rejeté). Le seul élément "en
dur" est le numéro de téléphone, pas l'authentification elle-même.

Cette migration vit dans `db/migration-dev/` (et non `db/migration/`) et n'est appliquée
par Flyway que sous le profil Spring `dev` (`spring.flyway.locations` n'inclut ce dossier
que dans le bloc `on-profile: dev` de `application.yml`) — même garde-fou que
`common.CorsConfig` (`@Profile("dev")`), activé par `SPRING_PROFILES_ACTIVE=dev` dans
`docker-compose.yml`. Sous tout autre profil (par défaut), la migration ne s'applique
jamais et ce compte n'existe pas : vérifié en démarrant le backend sans le profil `dev`
contre une base vierge — Flyway s'arrête à la version 3, et `POST /auth/login` avec
`0700000099` renvoie `404 NOT_FOUND` (aucun compte).

### Autorisation : matrice rôle × endpoint

Au-delà de l'authentification (JWT valide ou non), chaque endpoint protégé applique
une règle d'autorisation propre — un CLIENT authentifié n'a pas accès à tout :

| Endpoint | CLIENT | CIE_OPERATOR / CIE_ADMIN | DSI_ADMIN | Anonyme |
|---|---|---|---|---|
| `/api/v1/auth/**`, `/api/v1/meters/**`, `/api/v1/payments/callback`, `/api/v1/devices/**`, `/actuator/**` | — | — | — | ✅ |
| `GET /api/v1/customers/me` | ✅ (soi-même) | ✅ (soi-même) | ✅ (soi-même) | ❌ 401 |
| `GET /api/v1/recharges/{id}` | ✅ **si propriétaire uniquement**, sinon ❌ 403 | ✅ (toutes) | ✅ (toutes) | ❌ 401 |
| `POST /api/v1/recharges` | ✅* | ✅* | ✅* | ❌ 401 |
| `POST /api/v1/commands/{id}/retry` | ❌ 403 | ✅ | ❌ 403 | ❌ 401 |
| `GET /api/v1/audit`, `GET /api/v1/support/timeline` | ❌ 403 | ✅ | ✅ | ❌ 401 |

L'ownership sur `GET /api/v1/recharges/{id}` compare le `customerId` de la recharge
(en base) au sujet du JWT ; un non-propriétaire reçoit **403** (pas 404) — ces endpoints
exigent déjà une authentification, donc masquer l'existence de la ressource derrière un
404 n'a pas la même valeur défensive que sur une route publique, et 403 reste le code
HTTP standard pour "authentifié mais pas autorisé" (voir
`RechargeAuthorization`/`SecurityConfig` pour l'implémentation, `@PreAuthorize` +
bean réutilisable plutôt que dupliqué par contrôleur).

(*) `POST /api/v1/recharges` n'applique aucune vérification d'ownership du `customerId`
fourni dans le corps de la requête contre le JWT appelant : limite connue du PoC, hors
périmètre de ce correctif (qui porte sur la lecture/les actions support), à traiter avant
tout usage au-delà du laboratoire.

Conséquence pratique pour la recette : une recharge créée via un flux **système**
(webhook `payment-simulator`, ou l'endpoint de recette `forceInvalidToken` sans
`customerId` réel) n'appartient à aucun compte CLIENT enregistré — `GET
/api/v1/recharges/{id}` dessus nécessite donc le **token opérateur** (`0700000099`
ci-dessus), pas un token CLIENT. Les exemples T01/T05 ci-dessous utilisent `$TOKEN_OP`
pour cette raison.

## Scénario de test manuel (T01 → T15)

### T01 — Paiement nominal + T02/T03/T04 — bout en bout automatique

```bash
curl -X POST http://localhost:9000/simulate-payment \
  -H "Content-Type: application/json" \
  -d '{"meterId":"CIE-LAB-0001","customerId":"CUST-1","amountXof":5000}'
```

Ceci déclenche automatiquement toute la chaîne : paiement confirmé → token généré →
commande publiée sur MQTT → mock-dongle applique le crédit → ACK `ACCEPTED` → recharge
au statut `CREDIT_APPLIED`. Cet appel reste **non authentifié** (webhook système, voir
§Authentification).

Récupérer le `rechargeId` retourné par les logs backend, puis (endpoint protégé — utiliser
`$TOKEN_OP`, le token de l'opérateur de laboratoire : cette recharge provient du webhook
système et n'appartient à aucun CLIENT enregistré, voir §Autorisation ci-dessus) :

```bash
curl http://localhost:8080/api/v1/recharges/{rechargeId} \
  -H "Authorization: Bearer $TOKEN_OP"
```

Le champ `finalStatus` doit valoir `CREDIT_APPLIED`, `paymentStatus` doit valoir
`CONFIRMED`, et la liste `commands` doit contenir une commande au statut `ACCEPTED`.

### T05 — Token invalide → REJECTED

Le mock-dongle rejette tout token contenant le marqueur `INVALID` (voir `INVALID_TOKEN_MARKER`
dans `simulators/mock-dongle/dongle.py`). Pour déclencher ce cas en test manuel sans polluer
le flux nominal, `POST /api/v1/recharges` (protégé) accepte un champ optionnel
`forceInvalidToken` (booléen, `false` par défaut) qui force la génération d'un token
contenant ce marqueur au lieu du token normal `LABTKN-...` :

```bash
curl -X POST http://localhost:8080/api/v1/recharges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_OP" \
  -d '{"customerId":"CUST-1","meterId":"CIE-LAB-0001","amount":2000,"channel":"APP","idempotencyKey":"TEST-T05-1","forceInvalidToken":true}'
```

La commande passe par `SENT` puis reçoit un ACK `REJECTED` du mock-dongle ; vérifier via
`GET /api/v1/recharges/{rechargeId}` (toujours avec `$TOKEN_OP` : le `customerId` manuel
`"CUST-1"` ci-dessus n'appartient à aucun CLIENT enregistré, voir §Autorisation) que
`finalStatus` vaut `COMMAND_REJECTED` et que la commande listée est au statut `REJECTED`.
Un événement d'audit `COMMAND_REJECTED` (`errorCode: TOKEN_REJECTED`) doit apparaître dans
`GET /api/v1/audit?correlationId=...` (également réservé aux rôles support, utiliser
`$TOKEN_OP`). Ce champ n'a aucun effet sur le flux nominal (paiement confirmé via
`payment-simulator`) : il n'existe que sur l'endpoint de recharge manuelle.

### T06 / T12 — Double commande / rejeu

Envoyer deux fois le même paiement simulé avec le **même `providerTxId`** (nécessite un
petit script, `providerTxId` est généré aléatoirement par défaut dans le simulateur) —
ou appeler `POST /api/v1/recharges` (protégé) deux fois avec le même `idempotencyKey` :

```bash
curl -X POST http://localhost:8080/api/v1/recharges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_OP" \
  -d '{"customerId":"CUST-1","meterId":"CIE-LAB-0001","amount":2000,"channel":"APP","idempotencyKey":"TEST-KEY-1"}'

# Rejouer exactement la même requête :
curl -X POST http://localhost:8080/api/v1/recharges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_OP" \
  -d '{"customerId":"CUST-1","meterId":"CIE-LAB-0001","amount":2000,"channel":"APP","idempotencyKey":"TEST-KEY-1"}'
```

→ le second appel doit renvoyer le **même `rechargeId`**, et une seule commande doit avoir
été publiée sur MQTT (vérifiable via `GET /api/v1/recharges/{id}` avec `$TOKEN_OP` : une
seule entrée dans `commands`).

### T15 — Auditabilité bout en bout

```bash
curl "http://localhost:8080/api/v1/audit?correlationId={correlationId}" \
  -H "Authorization: Bearer $TOKEN_OP"
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

## Résilience (T07/T08/T09 — §14_TestMatrix / §16_FailureInjection)

Tests exécutés réellement via `docker compose stop/start/restart` (pas en théorie), qui ont
mené à des corrections de code. Le round-trip MQTT local (quelques ms) est trop rapide pour
interrompre une commande *après* son envoi via de simples commandes shell séquentielles ;
les scénarios ci-dessous adaptent donc l'ordre des étapes pour créer une fenêtre
d'indisponibilité réelle et observable, tout en restant fonctionnellement équivalents à ce
que décrit `§16_FailureInjection`.

### T07 — Perte réseau/broker MQTT

**Bugs trouvés et corrigés** (aucun n'était visible avant un test réel avec coupure) :

1. `MqttClientProvider` recréait un second `MqttClient` (même clientId) dès que
   `isConnected()` était `false`, entrant en conflit avec la reconnexion automatique de
   Paho (`automaticReconnect(true)`) — corrigé : le client n'est créé qu'une seule fois,
   la reprise sur coupure est intégralement déléguée à Paho + à la session persistante du
   broker (`cleanSession(false)`).
2. Aucun mécanisme ne détectait une commande qui ne recevait jamais d'ACK (broker/dongle
   injoignable au moment de l'envoi) : elle restait bloquée indéfiniment en
   `PENDING`/`SENT`. Ajout de `CommandExpiryWatcher` (`@Scheduled`, toutes les 10s) qui
   retrouve ces commandes dont `expiresAt` est dépassé et les fait passer par
   `handleAck(..., TIMEOUT, ...)`, déclenchant le retry/fallback déjà prévu par ALG-02.
3. Le retry (`handleTimeout`) publiait directement dans la transaction, avant commit —
   exactement la même course que le bug corrigé précédemment sur l'envoi initial (voir
   historique). Corrigé en le faisant passer par le même mécanisme différé
   (`CommandDispatcher`/`CommandSendFinalizer`, publication après commit). La fenêtre de
   validité (`expiresAt`) n'était pas non plus renouvelée sur retry (le token aurait été
   republié déjà hors-fenêtre) — ajout de `MeterCommand.renewExpiry(...)`.
4. **Trouvé en testant réellement le point 2** : un retry peut lui-même se perdre si le
   dongle n'a pas fini de se réabonner au moment exact de la republication. La première
   version de `CommandExpiryWatcher` excluait le statut `TIMEOUT` de sa recherche
   (supposant qu'un seul passage suffisait), donc une commande dont le retry échouait
   restait bloquée en `TIMEOUT` pour toujours. Corrigé en incluant `TIMEOUT` dans la
   recherche, pour que le job retente jusqu'à épuisement de `MAX_RETRIES` (3) avant
   fallback définitif.

**Déroulé observé** : `docker compose stop mosquitto`, puis `POST /api/v1/recharges` →
`500` côté client (la publication échoue de façon synchrone) mais la recharge et la
commande sont bien persistées (`TOKEN_GENERATED` / `PENDING`) — **aucune perte de
données malgré l'erreur renvoyée**. Après `docker compose start mosquitto` (sans toucher
au conteneur backend ni mock-dongle), les logs montrent une reconnexion **automatique**
des deux côtés (`Client poc-backend-gateway ... session taken over` côté broker,
`Connecté au broker MQTT` côté mock-dongle). Une fois le TTL (60s) dépassé,
`CommandExpiryWatcher` a fait passer la commande en `TIMEOUT` puis republié — le premier
retry (`retry_count=1`) a lui-même été perdu (mock-dongle pas encore réabonné, bug #4
ci-dessus, corrigé), le second (`retry_count=2`) a abouti à `CREDIT_APPLIED`. Effet de
bord positif : une commande orpheline d'une session de test précédente (bloquée depuis
plus d'une heure, avant le tout premier correctif d'idempotence de ce projet) a été
retrouvée et résolue automatiquement par ce même mécanisme dès le démarrage du backend.

### T08 — Redémarrage du dongle

**Aucune correction nécessaire** — comportement correct par construction :

- `on_connect` (`dongle.py`) se réabonne systématiquement à `COMMAND_TOPIC` à chaque
  (re)connexion, y compris après redémarrage : confirmé via les logs
  (`Connecté au broker MQTT` immédiatement suivi de `Abonné à cie/lab/DONGLE-LAB-0001/command/token`).

**Limite connue à documenter avant le banc réel** : `MeterState` (crédit accumulé,
mémoire anti-rejeu `processed_command_ids`) est un simple objet Python en mémoire, sans
aucune persistance. Un `docker compose restart mock-dongle` l'efface entièrement —
vérifié : le crédit affiché par `GET /meters/CIE-LAB-0001/credit` est passé de `17500.0`
à `0.0` après redémarrage, alors que les recharges correspondantes restent correctement
`CREDIT_APPLIED` côté backend (le système de référence, PostgreSQL, reste intact et fait
autorité ; seul l'état simulé du compteur mock est volatile). Acceptable pour un PoC
logiciel dont l'objet est de valider l'orchestration/idempotence côté backend, mais **à
proscrire sur un vrai dongle/compteur** : un redémarrage matériel ne doit jamais
réinitialiser le crédit ni oublier les commandes déjà traitées (mémoire flash/secure
element requise, hors scope logiciel du PoC).

### T09 — Coupure/redémarrage du backend

**Aucune correction nécessaire** pour les garanties fondamentales — vérifié par
construction :

- Flyway ne rejoue jamais les migrations au redémarrage (`Schema "public" is up to date.
  No migration necessary.`, confirmé à chaque redémarrage effectué pendant toute cette
  session de tests).
- Aucune corruption : les recharges/commandes créées avant un arrêt du backend restent
  intactes et interrogeables après.
- Le QoS1 + session persistante (`cleanSession(false)`) redélivre bien un ACK publié
  pendant que le backend est complètement arrêté : vérifié en publiant manuellement (via
  `mosquitto_pub` avec le certificat `DONGLE-LAB-0001`) un ACK référençant une commande
  réellement en attente, backend arrêté, puis en le redémarrant — les logs mosquitto
  confirment la session restaurée (`Restored 1 clients / 1 subscriptions`) et le message
  en attente est bien délivré à la reconnexion.

**Limite/nuance découverte en testant** : une course bénigne existe entre (a) la
délivrance du message MQTT en attente et (b) le tout premier passage de
`CommandExpiryWatcher`, qui se déclenche quasi immédiatement au démarrage. Dans nos
essais, le watcher a systématiquement traité la commande comme `TIMEOUT` (déclenchant un
retry) avant que l'ACK mis en attente ne soit effectivement lu — le système reste
cohérent et finit par converger vers `CREDIT_APPLIED` grâce au retry, mais l'ACK
d'origine peut ainsi se retrouver sans effet plutôt que d'être celui qui résout la
commande. Sans conséquence sur la correction du PoC (aucune perte, juste un retry
surnuméraire), mais à garder à l'œil avant un vrai banc : il n'y a pas de garantie
stricte d'ordre entre "traiter les messages MQTT en attente à la reconnexion" et "le
premier passage du job planifié" au démarrage.

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

## Ce qui est fait vs. ce qui reste (statut au 25/08/2026)

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
| Backend Java : compilation/tests réels | ✅ `mvn test` exécuté, build Docker validé |
| Sécurité: mTLS, ACL MQTT par device (certificats de labo) | ✅ Implémenté (PKI de laboratoire — PKI CIE réelle restant à faire, voir dossier de recette) |
| customer/auth (inscription, connexion OTP-only, JWT) | ✅ Implémenté et testé end-to-end (voir §Authentification) — SMS mocké (log console), pas d'intégration réelle |
| Endpoints protégés par JWT (recharges, commandes/retry, audit, support/timeline) | ✅ Implémenté (Spring Security, profil non conditionné — actif dans tous les environnements) |
| Autorisation par rôle/ownership (client limité à ses propres recharges, retry/audit réservés CIE_OPERATOR/CIE_ADMIN/DSI_ADMIN) | ✅ Implémenté et testé end-to-end avec deux comptes clients réels + le compte opérateur de laboratoire (voir §Autorisation) — `@PreAuthorize` + bean réutilisable pour l'ownership, restrictions par rôle dans `SecurityConfig` pour retry/audit/support |
| incident-service, rules-engine-service (V2) | ⛔ Hors scope PoC actuel |

> **Statut détaillé des tests (T01–T15, C01–C07), anomalies corrigées, critères
> d'acceptation Gate 1 et recommandation GO/NO-GO pour le Gate 2** : voir le
> [dossier de recette Gate 1](docs/04_dossier-recette-gate1.md) — ce document fait foi pour
> tout ce qui concerne les résultats de tests ; ce tableau ne couvre que l'avancement du code.

## Prochaine étape recommandée

Voir la section 6 ("Recommandation GO/NO-GO") du
[dossier de recette Gate 1](docs/04_dossier-recette-gate1.md) pour la liste à jour des
conditions préalables avant le Gate 2 (banc réel CIE).
