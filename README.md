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
| T07 (perte réseau MQTT) | ✅ Testé (`docker compose stop/start mosquitto`) + `CommandExpiryWatcher` ajouté (sans lui, une commande sans ACK restait bloquée indéfiniment) |
| T08 (redémarrage dongle) | ✅ Testé (`docker compose restart mock-dongle`) — OK par construction ; limite connue : `MeterState` du mock non persistant (voir §Résilience) |
| T09 (coupure/redémarrage backend) | ✅ Testé (`docker compose stop/start backend`) — OK par construction (Flyway, intégrité DB, QoS1) ; nuance d'ordonnancement documentée (§Résilience) |
| incident-service, rules-engine-service (V2) | ⛔ Hors scope PoC actuel |

## Prochaine étape recommandée

1. Qualifier le compteur/protocole réel avec la CIE (Gate 0) avant tout raccordement physique.
2. Remplacer la PKI de laboratoire auto-signée par la PKI approuvée par la Cybersécurité
   CIE (mTLS + ACL par device restent la même mécanique, seuls les certificats changent).
3. Étendre les tests de sécurité aux autres cas de `§18_CyberTests` (C01, C03-C07) sur le
   modèle de `infra/mosquitto/test-acl-c02.sh`.
4. Avant le banc réel : ajouter une persistance de l'état compteur/dongle (T08) et lever
   la course décrite en §Résilience/T09 entre redélivrance MQTT et `CommandExpiryWatcher`
   au démarrage (ex. délai initial du job après la reprise de session MQTT).
