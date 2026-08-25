# Réconciliation des contrats API — Frontend ↔ Backend

Document de **diagnostic et de proposition**, pas d'implémentation. Référence de départ :
`docs/03_architecture-v2-classeur.md` §API_CONTRACTS (et, en complément, §JAVA_SPEC,
§NODEJS_SPEC, §09_Backlog_API_Code, §04_Algorithmes — le contrat cible d'un endpoint donné
est parfois plus complet dans ces sections annexes que dans le tableau API_CONTRACTS
lui-même, qui est volontairement synthétique).

Périmètre : backend et frontend visent tous deux la cible produit réelle (confirmé) — ce
document ne traite donc plus le backend comme un "PoC jetable" à ignorer, mais compare
trois sources sur un pied d'égalité : la cible documentée (docs/03), l'implémentation
backend actuelle, et les attentes frontend actuelles.

## Méthode

Pour chaque endpoint : (1) ce que docs/03 documente, (2) ce que le backend expose
aujourd'hui (lu dans le code, pas supposé), (3) ce que le frontend attend aujourd'hui (lu
dans `frontend/src/services/api.ts` et `frontend/src/types/index.ts`, pas supposé), (4) un
contrat proposé avec justification. Aucun fichier de code n'est modifié par ce document.

---

## 1. `POST /api/v1/recharges`

**docs/03 (API_CONTRACTS)** :
`customerId, meterId, amount, channel, idempotencyKey` → `rechargeId, status, correlationId`.
Sécurité : OAuth2, mTLS interne.

**Backend aujourd'hui** (`RechargeController` + `RechargeRequest`/`RechargeResponse`) :
- Requête : `customerId, meterId, amount, channel, paymentProvider, paymentId, idempotencyKey, forceInvalidToken`
- Réponse : `rechargeId, status, correlationId, meterId, amountXof`
- Sécurité : aucune (pas de dépendance Spring Security dans le projet).

**Frontend aujourd'hui** : **aucun appel réel**. `createSimulatedRecharge()` génère tout
côté client (`rechargeId, transactionId, tokenId, commandId, correlationId, amount,
energyValue, provider, meterId, tokenValue`) sans requête réseau. L'interface `ApiAdapter`
ne déclare même pas de méthode `createRecharge`.

**Constat notable** : le nom des 5 champs d'entrée documentés par docs/03
(`customerId, meterId, amount, channel, idempotencyKey`) et les 3 champs de sortie
(`rechargeId, status, correlationId`) **correspondent exactement** aux noms déjà utilisés
côté backend. C'est le contrat le mieux aligné des cinq étudiés ici — la seule différence
réelle est l'absence de sécurité (OAuth2/mTLS non implémentée, cohérent avec le fait
qu'aucun domaine d'authentification n'existe encore, voir §Auth).

**Point d'architecture à trancher** : docs/03 (ALG-02 étape 1, NODEJS_SPEC
`payment-adapter-service`) décrit le flux nominal comme *paiement Mobile Money confirmé
→ webhook signé → déclenchement automatique de la recharge* — ce qui correspond au
`POST /api/v1/payments/callback` du backend (`startFromConfirmedPayment`), pas au
`POST /api/v1/recharges` manuel (`startManual`). Le `POST /api/v1/recharges` actuel est donc
plutôt un outil de recette/support (comme le confirme son champ `forceInvalidToken`, absent
de docs/03) qu'un endpoint client final. Le futur `provider` (Wave/Orange/MTN/Moov) que le
frontend voudra probablement envoyer appartiendrait alors plutôt au futur
`POST /api/v1/mobile-money/webhook` (initiation du paiement) qu'à `POST /api/v1/recharges`
lui-même.

**Contrat proposé** :
- Garder `POST /api/v1/recharges` tel quel comme endpoint **support/recette** (`operatorId`
  implicite, réservé aux rôles CIE/DSI une fois l'auth en place) — ne pas y ajouter
  `provider`.
- Ouvrir séparément, en V2, `POST /api/v1/mobile-money/webhook` (docs/03) comme point
  d'entrée du flux **client** réel, avec `provider` + `signature` en entrée — c'est là que
  vivrait la logique "Wave/Orange/MTN/Moov" attendue par le frontend.
- Retirer `forceInvalidToken` du contrat "officiel" (le documenter comme paramètre de test
  interne, pas un champ de contrat public).

---

## 2. `GET /api/v1/recharges/{id}`

**docs/03** : entrée `rechargeId` → sortie `paymentStatus, commandStatus, finalStatus`.

**Backend aujourd'hui** (`RechargeDetailResponse`) :
`rechargeId, finalStatus, correlationId, meterId, amountXof, createdAt, updatedAt,
commands[]` (chaque commande : `commandId, deviceId, status, sequence, retryCount, sentAt,
ackAt`).

**Frontend aujourd'hui** : pas de `GET` par id dans l'interface `ApiAdapter` — le
commentaire mentionne `GET /api/v1/recharges/history` (une **liste**, pas un détail par id ;
opération différente). Le type `Transaction` correspondant attend :
`transactionId, paymentId, rechargeId, tokenId, meterId, customerId, provider, amount,
energyValue, status, createdAt, correlationId`.

**Constat** : `finalStatus` matche exactement docs/03. En revanche `paymentStatus` et
`commandStatus` documentés par docs/03 comme deux champs **séparés** n'existent pas tels
quels côté backend : le statut de paiement (`Payment.status`, existe en base — PENDING/
CONFIRMED/FAILED) n'est **jamais exposé** par cet endpoint, et le "statut de commande" n'est
disponible qu'indirectement via le tableau `commands[]` (une recharge peut avoir plusieurs
commandes en cas de retry — docs/03 semble supposer un statut de commande unique et agrégé,
ce qui ne tient pas dès qu'on modélise les retries, cf. `§14_TestMatrix T07`).

**Contrat proposé** :
- ~~Ajouter `paymentStatus` à `RechargeDetailResponse`~~ — **fait** : `paymentStatus` est
  désormais résolu via `Payment` (chargé par `recharge.getPaymentId()`) et exposé dans
  `RechargeDetailResponse`. Vaut `null` (pas d'erreur) quand `paymentId` ne correspond à
  aucun `Payment` réel — cas des recharges de recette créées via l'endpoint manuel sans
  paiement préalable (T05/T06). La question RBAC (qui peut voir le statut de paiement d'une
  recharge) reste à trancher une fois l'auth en place (§8) — pour l'instant, l'endpoint
  reste ouvert comme le reste du PoC.
- Remplacer le `commandStatus` singulier de docs/03 par le `commands[]` déjà présent côté
  backend (plus riche et déjà correct pour représenter les retries) — proposer cette
  correction *à* docs/03 plutôt que d'appauvrir le backend pour coller à un contrat qui ne
  gère pas le retry.
- Ajouter `paymentId` si le frontend a besoin de tracer `Transaction.paymentId` — **ne pas**
  ajouter `tokenHash` ni le token : voir note de sécurité ci-dessous.

**✅ Confirmation sécurité token — déjà conforme, aucun changement requis** : ni
`RechargeResponse` ni `RechargeDetailResponse` n'exposent le token, en clair ou hashé.
`Recharge` (entité JPA) ne persiste que `tokenHash` (`recharge.token_hash` en base, via
`TokenHasher.sha256(...)`) — le token en clair (`tokenPlaintext`) n'existe jamais que le
temps d'un appel MQTT (`CommandPublisher`) et n'est jamais écrit en base ni renvoyé par
aucun DTO. Vérifié en relisant `Recharge.java`, `RechargeResponse.java` et
`RechargeDetailResponse.java` : aucun des deux DTO ne déclare de champ `token`/`tokenHash`/
`tokenValue`. Conforme à la décision validée (le client ne doit jamais voir le token en
clair) et à `CLAUDE.md` règle #3 / test C05, sans qu'aucune modification n'ait été
nécessaire ici.

---

## 3. `GET /api/v1/meters/{id}/status`

**docs/03** : entrée `meterId` → sortie `onlineStatus, credit, lastReadingAt`.

**Backend aujourd'hui** (`DeviceController`) :
`meterId, deviceId, deviceStatus, lastSeen, onlineStatus, creditBalance, creditUnit`.

**Frontend aujourd'hui** : attend `GET /api/v1/meters/{meterId}` (**sans** le suffixe
`/status` !) retournant un objet `Meter` bien plus riche :
`meterId, customerId, deviceId, status, creditFcfa, creditKwh, creditPercent, creditStatus,
autonomyDays, lastHeartbeat, voltage, current, consumptionTodayKwh, location, alertCount`.

**Constat** :
- `onlineStatus` matche exactement.
- docs/03 dit `credit` (un seul champ, type non précisé) ; le backend expose
  `creditBalance` + `creditUnit` séparément — plus précis, à garder (proposer cette
  précision *à* docs/03).
- docs/03 dit `lastReadingAt` ; le backend expose `lastSeen`. **Ce ne sont probablement
  pas le même concept** : `lastReadingAt` évoque la dernière *lecture de consommation*,
  `lastSeen` (issu du heartbeat, §ALG-03) évoque la dernière fois que le *device a été vu en
  ligne*. Le backend n'a aujourd'hui qu'un seul de ces deux timestamps.
- `creditPercent`, `autonomyDays`, `creditStatus` (frontend) **ne sont pas inventés** :
  ils correspondent exactement à l'algorithme **ALG-01 "Calcul autonomie crédit"**
  (docs/03 §04_Algorithmes) — les 5 valeurs de `CreditStatus`
  (`NORMAL/WATCH/LOW/CRITICAL/CUT_RISK`) sont un copier-coller littéral des seuils ALG-01
  ("NORMAL > 7 jours, WATCH <= 7, LOW <= 3, CRITICAL <= 1, CUT_RISK <= 0.125"). **ALG-01
  n'est cependant implémenté nulle part côté backend actuellement** (aucune classe
  `RechargePolicy`/`Prediction`, aucun endpoint ne calcule d'autonomie) : c'est un algorithme
  documenté mais jamais câblé à une route API dans docs/03 non plus. C'est un vrai
  **trou de contrat des deux côtés**, pas une invention frontend.
- `consumptionTodayKwh` et `alertCount` tracent au widget "Consommation"/"Alerte" de
  §05_Dashboard_Client (avec les exemples KPI "Conso jour kWh: 3.2" / "Alertes actives: 1").
- `voltage`/`current` tracent à ALG-04 (scoring fraude : "incohérence tension/courant"),
  mais ALG-04 est **côté supervision CIE**, pas côté dashboard client (`§05_Dashboard_Client`
  ne les liste pas parmi les widgets client). Le frontend les met sur le type `Meter`
  partagé — à vérifier si c'est bien voulu pour l'écran **client**, ou si ça devrait rester
  réservé à un écran CIE/fraude.
- `location` : aucune trace précise dans docs/03 côté client (seul `06_Dashboard_CIE`
  parle de "zones" agrégées côté exploitation).
- `status` (frontend, `MeterStatus`: `ONLINE/OFFLINE/WARNING/MAINTENANCE`) vs backend
  `DeviceStatus` (`UNKNOWN/ONLINE/OFFLINE` seulement, `Device.java`) : deux enums
  incompatibles — `WARNING` et `MAINTENANCE` n'existent pas côté backend.

**Contrat proposé** :
- Renommer/aligner sur `GET /api/v1/meters/{meterId}/status` (garder le suffixe backend,
  conforme à docs/03 — c'est le frontend qui devra s'aligner, pas l'inverse, puisque
  docs/03 fait référence ici).
- Étendre la réponse backend avec `creditPercent` et `autonomyDays`, mais seulement une fois
  ALG-01 réellement implémenté côté backend (pas de valeur calculée à la volée dans le
  contrôleur) — sinon on expose un champ qui n'a pas de logique métier derrière.
- Élargir `DeviceStatus` avec `WARNING`/`MAINTENANCE` **seulement si un besoin métier réel
  les justifie** (à confirmer : que signifierait "WARNING" pour un device qui n'a que
  online/offline aujourd'hui ?).
- Décider explicitly si `voltage`/`current` doivent apparaître sur l'écran **client** ou
  rester réservés à un futur écran CIE — c'est une décision produit, pas technique.

---

## 4. Audit / timeline

**docs/03** : `GET /support/timeline` (§09_Backlog_API_Code) — "Timeline complète et
filtrable", responsable Java/React, aucun contrat de champs précisé à ce niveau de détail
(le tableau API_CONTRACTS ne liste pas cet endpoint séparément). `audit-service`
(§JAVA_SPEC) est décrit par les classes `AuditRecord, Actor, Operation` et l'événement
`AuditAppended`, sans contrat REST explicite.

**Backend aujourd'hui** — **deux endpoints**, et l'un d'eux correspond déjà très bien :
- `GET /api/v1/audit?correlationId=` → liste d'`AuditEvent`
  (`auditId, correlationId, actor, action, entityType, entityId, result, errorCode,
  details, timestamp`).
- `GET /api/v1/support/timeline?entityType=&entityId=` → même forme, filtrée par entité.
  **Le chemin `/support/timeline` correspond exactement au nom documenté dans
  docs/03** — c'est le meilleur alignement de tout ce document.

**Frontend aujourd'hui** : attend `GET /api/v1/dsi/audit` (chemin différent, préfixe
`dsi` propre au portail admin) retournant `AuditEvent` (TS) :
`eventId, actor, action, resource, timestamp, correlationId, status`.

**Constat** : `actor`, `action`, `correlationId`, `timestamp` matchent tels quels.
`resource` (frontend) ≈ `entityType`+`entityId` (backend) fusionnés en une chaîne — le
backend est plus précis/filtrable (cohérent avec le fait que `/support/timeline` prend déjà
`entityType`+`entityId` en paramètres). `status` (frontend) ≈ `result` (backend), simple
renommage. `eventId` (frontend) ≈ `auditId` (backend), simple renommage.
`errorCode`/`details` (backend) n'ont pas d'équivalent frontend (perte d'info si on
mappait tel quel).

**Contrat proposé** :
- Adopter le chemin backend existant (`/api/v1/support/timeline` et `/api/v1/audit`) —
  c'est lui qui correspond à docs/03, pas `/api/v1/dsi/audit`.
- Garder `entityType`/`entityId` séparés côté backend (plus utile que `resource` fusionné) ;
  le frontend fusionnera à l'affichage si besoin, pas l'inverse.
- Ajouter `errorCode` au type frontend `AuditEvent` — perdre cette info en supervision serait
  regrettable.

---

## 5. `POST /api/v1/commands/{id}/retry`

**docs/03** : **aucun contrat REST documenté**. §JAVA_SPEC (`command-service`) ne liste que
des événements (`CommandSent; CommandAcked; CommandFailed`) — pas de `CommandRetried`.
ALG-02 étape 7 décrit le retry comme un mécanisme **automatique interne**
("retry exponentiel avec limite N et dead-letter queue"), pas une action déclenchée
manuellement via API.

**Backend aujourd'hui** : `POST /api/v1/commands/{id}/retry?operatorId=` — relance manuelle
par un opérateur support/L2 (`RechargeOrchestrator.retryCommand`), en plus du retry
automatique déjà implémenté (`CommandExpiryWatcher`, cf. dossier de recette Gate 1, T07).

**Frontend aujourd'hui** : aucune trace — ni méthode d'API, ni type, ni écran.

**Constat** : c'est l'endpoint le moins couvert par docs/03 des cinq étudiés — ni confirmé
ni contredit. Le besoin métier est réel (ALG-05 : "Escalader L2 si L1 ne peut confirmer...")
mais docs/03 ne dit pas comment cette escalade agit concrètement sur une commande.

**Contrat proposé** :
- Garder l'endpoint tel quel côté backend (utile en l'état, aucun conflit avec docs/03).
- Le documenter formellement **dans docs/03** (ajout à API_CONTRACTS et à la liste
  d'événements de `command-service`, ex. `CommandRetriedManually`) plutôt que de le laisser
  implicite — c'est un ajout à proposer aux mainteneurs de docs/03, pas un contrat à
  redessiner.
- Ne l'exposer au frontend que dans l'écran opérateur CIE/L2 (jamais côté client), une fois
  le rôle `CIE_OPERATOR` du frontend (`DsiUser.role`) relié à une vraie authentification.

---

## 6. Heartbeat device

**docs/03** (ALG-03 étape 1) : *"Chaque device publie heartbeat périodique avec
timestamp, RSSI, opérateur, batterie/alim, firmware."*

**Backend aujourd'hui** : `POST /api/v1/devices/{deviceId}/heartbeat` — **aucun corps de
requête**. `DeviceService.registerHeartbeat()` met seulement à jour `lastSeen` et bascule
`status` à `ONLINE`. Aucun champ RSSI/opérateur/batterie n'est capturé ni stocké nulle part
dans le schéma actuel ; `firmwareVersion` existe sur `Device` mais est fixé à
l'enregistrement du device, jamais mis à jour par le heartbeat.

**Frontend aujourd'hui** : **sans objet** — ce n'est pas un appel que le frontend (navigateur
client) est censé faire ; c'est le dongle/mock-dongle qui l'émet. Le frontend a en revanche
un type `Device` (`deviceId, meterId, firmware, status, credentialStatus, lastSeen`) pour un
écran de **listage** des devices (`GET /api/v1/dsi/devices` selon son commentaire) — un
endpoint totalement différent (lecture vs ingestion) qui **n'existe pas du tout** côté
backend aujourd'hui.

**Constat** : c'est l'écart le plus net avec docs/03 — le payload de heartbeat documenté
(RSSI, opérateur, batterie/alim) n'est ni transmis ni modélisé aujourd'hui. C'est cohérent
avec le fait que le PoC utilise `MockMeterAdapter`/`mock-dongle`, qui n'ont pas ces capteurs
à simuler pour l'instant — mais si le heartbeat réel du futur firmware doit transmettre ces
données (ALG-03 en dépend directement pour distinguer `TELECOM_SUSPECT` de
`POWER_OUTAGE_SUSPECT`), le endpoint et le schéma `device`/`device_telemetry` devront
évoluer.

**Contrat proposé** :
- Étendre `POST /api/v1/devices/{deviceId}/heartbeat` avec un corps optionnel
  `{rssi, operatorName, batteryLevel, firmwareVersion}` — rétrocompatible (heartbeat sans
  corps reste valide), mais nécessite une nouvelle table/colonnes de télémétrie.
- Créer séparément `GET /api/v1/dsi/devices` (ou un chemin aligné docs/03 — non spécifié,
  à trancher) pour le besoin de listage frontend — **actuellement absent, à ajouter**,
  distinct du endpoint d'ingestion.

---

## 7. Champs et endpoints frontend sans aucune trace dans docs/03

Liste consolidée, tous types confondus — **c'est le point précis à trancher avec ton ami**
avant toute implémentation.

### Sans trace du tout (ni docs/03, ni concept apparenté identifiable)

- **`PaymentProvider` : `WAVE | ORANGE_MONEY | MTN_MONEY | MOOV_MONEY`** — docs/03 mentionne
  "Mobile Money" génériquement partout (00_Sources, EXEC_DG_V2, NODEJS_SPEC
  `payment-adapter-service`) mais **ne nomme jamais d'opérateur précis**. Ces 4 noms sont une
  connaissance du marché ivoirien injectée par le frontend, pas une donnée des docs
  sources.
- **`Meter.location`** (chaîne libre) — aucune section ne documente un champ de localisation
  au niveau compteur pour l'écran client (seul `06_Dashboard_CIE` a une notion de "zones"
  agrégées, pas un champ par compteur).
- **`MeterStatus.WARNING` / `MeterStatus.MAINTENANCE`** — docs/03 (ALG-03) ne connaît que
  ONLINE/OFFLINE + les 4 classifications d'incident offline (`OFFLINE_INDIVIDUAL`,
  `OFFLINE_CLUSTER`, `TELECOM_SUSPECT`, `POWER_OUTAGE_SUSPECT`) ; ni "WARNING" ni
  "MAINTENANCE" n'apparaissent.
- **`Token.tokenValue`** exposé au client — voir alerte sécurité ci-dessous.
- **Tout le domaine `DsiUser`** (`role: CLIENT|CIE_OPERATOR|CIE_ADMIN|DSI_ADMIN`,
  `status: ACTIVE|SUSPENDED`, `lastLogin`) — docs/03 mentionne "RBAC" génériquement (
  §JAVA_SPEC meter-registry-service, §NODEJS_SPEC portal-cie-bff) mais ne documente aucune
  taxonomie de rôles ni de gestion d'utilisateurs. Directement lié au trou d'authentification
  (§8).
- **`Alert.read`** (booléen de lecture par l'utilisateur) — état d'interface pure, jamais
  spec'd (raisonnable de le garder purement frontend, pas un manque grave).
- **`GET /api/v1/dsi/audit`, `GET /api/v1/dsi/users`, `GET /api/v1/dsi/devices`,
  `GET /api/v1/dsi/services`, `GET /api/v1/cie/meters`, `GET /api/v1/cie/incidents`** — le
  préfixe `/dsi/*` et `/cie/*` n'apparaît nulle part dans docs/03 (qui utilise des préfixes
  différents : `/support/*`, `/ops/*`, ou aucun préfixe de portail). Convention d'URL à
  choisir explicitement, pas héritée des docs.

### Concept documenté, mais jamais câblé à un contrat API précis

Ces champs ne sont **pas inventés** au sens strict — ils tracent à un algorithme ou un widget
documenté — mais docs/03 ne dit jamais par quel endpoint/champ ils transitent :

- `Meter.creditPercent`, `Meter.autonomyDays`, `Meter.creditStatus` → ALG-01 (non implémenté
  côté backend non plus).
- `ConsumptionPoint.costFcfa` → nécessite un tarif ; le frontend l'assume déjà explicitement
  comme mock (`MOCK_TARIFF_FCFA_PER_KWH`, commenté "ne représente PAS le tarif CIE réel").
- `AutoRechargeConfig.*` → trace précisément à `ALGO_AUTO_RECHARGE` (docs/03 lignes 205-216),
  bon alignement conceptuel, juste aucun endpoint REST proposé nulle part pour le configurer.
- `NotificationPrefs.*` → trace à "Notification Service... préférence client" (§JAVA_SPEC/
  NODEJS_SPEC), sans détail de contrat.
- `Device.firmware`, `Device.credentialStatus` → tracent à "Device Registry APIs... gère
  firmware et certificats" (§09_Backlog) et à "Certificats expirants" (§06_Dashboard_CIE).

### ⚠️ Point de sécurité à signaler séparément (pas qu'un écart de contrat)

`Token.tokenValue` : le frontend le déclare lui-même *"valeur masquable — MOCK uniquement"*
— mais son existence même comme champ transmis au client contredit une règle non négociable
du backend (`CLAUDE.md` règle #3 : *"Token jamais loggé en clair"*, test C05) et le principe
STS référencé par docs/03 (00_Sources : *"système de message sécurisé pour le transfert de
tokens de prépaiement"*). Avant d'implémenter quoi que ce soit ici, il faut trancher :
le token en clair doit-il **jamais** atteindre le navigateur (fallback token visible via un
canal séparé, ex. SMS — cf. `RG-C-005`/`FALLBACK_TOKEN_SENT` déjà dans le backend), ou existe-
t-il un cas d'usage légitime où le client doit le voir (ex. mode dégradé de saisie manuelle) ?
C'est une décision de sécurité, pas de nommage de champ.

---

## 8. Authentification / domaine client — trou de périmètre, à planifier séparément

Le frontend implémente un flux complet `login` (téléphone + mot de passe), `register`,
`verify-otp`, `getMe()`. **Le backend n'a aucune notion de client authentifié** :
- Aucune dépendance Spring Security dans `pom.xml`.
- Aucune entité `Customer` dans le schéma DB actuel (`payment`, `command`, `audit_event`,
  `device`, `meter` seulement — voir `docs/02_developer-pack-poc.md` §11_DB).
- Aucun endpoint `/auth/*` ni `/customers/*`.

Ce n'est pas un simple champ manquant : c'est un **domaine backend entier à créer**. docs/03
donne quelques indices mais reste flou sur qui le porte :
- `meter-registry-service` (§JAVA_SPEC) a `Customer` dans ses classes clés, aux côtés de
  `Meter, Device, SimProfile` — suggère que `Customer` serait géré par ce service, pas par un
  service d'auth dédié.
- `customer-bff` (§NODEJS_SPEC) mentionne "sécurité JWT" pour `GET /customer-dashboard/:id`
  mais ne décrit ni l'émission du JWT, ni le flux de login/OTP.
- Aucune section ne mentionne explicitement un service d'authentification/identité, de
  gestion de mot de passe, ni de flux OTP — ces briques sont **absentes de docs/03**, pas
  seulement non détaillées.

**Ce que ça impliquerait côté backend** (documenté ici comme item de scope, **non
implémenté**) :
1. Un nouveau domaine `customer` (à ajouter au monolithe PoC actuel, ou nouveau service
   `customer-service` en V2) avec une entité `Customer` (identité, téléphone, email,
   `meterId`/`contractId` associés) — à ajouter au schéma DB.
2. Un mécanisme d'authentification (Spring Security + JWT, cohérent avec la mention "JWT
   client" du `customer-bff` dans docs/03) : `POST /api/v1/auth/login`,
   `POST /api/v1/auth/register`, `POST /api/v1/auth/verify-otp`.
3. Un fournisseur OTP (SMS) — dépendance externe non présente dans la stack actuelle
   (`Notification Service` existe dans docs/03 mais n'est pas implémenté dans ce repo).
4. Une politique RBAC reliant `Customer` (rôle `CLIENT`) aux rôles CIE/DSI attendus par le
   frontend (`DsiUser.role`), et un mécanisme pour associer un `Customer` authentifié à
   `POST /api/v1/recharges` (aujourd'hui, `customerId` est un simple champ de requête, non
   vérifié contre une identité authentifiée — n'importe qui peut recharger n'importe quel
   `meterId`/`customerId` aujourd'hui, ce qui est acceptable pour un PoC labo mais pas pour
   la cible produit).
5. Une décision de sécurité sur le masquage du token (voir §7 ci-dessus), qui recoupe
   directement l'authentification : un token visible au client authentifié n'a pas les mêmes
   implications qu'un token visible à quiconque.

Ce domaine touche à la fois `recharge-core-service` (association customer↔recharge) et
justifierait potentiellement son propre `customer-service`, cohérent avec le découpage
`meter-registry-service` déjà prévu par docs/03 — **à trancher avec ton ami avant tout
développement**, car ça détermine si l'auth vit dans le monolithe PoC actuel ou dans un
nouveau service séparé.

---

## Résumé exécutable

| # | Endpoint | Alignement docs/03 ↔ backend | Alignement docs/03 ↔ frontend | Prêt à connecter tel quel ? |
|---|---|---|---|---|
| 1 | `POST /api/v1/recharges` | **Fort** (noms de champs identiques) | Aucun (pas d'appel réel) | Oui pour le support/recette ; non pour le flux client (voir webhook) |
| 2 | `GET /api/v1/recharges/{id}` | Partiel (`finalStatus` ok, `paymentStatus` absent) | Aucun (attend `/history`, pas `/{id}`) | Non — ajouter `paymentStatus` d'abord |
| 3 | `GET /api/v1/meters/{id}/status` | Partiel (`onlineStatus` ok, reste différent) | Faible (URL différente, objet bien plus riche) | Non — ALG-01 pas implémenté, enums incompatibles |
| 4 | `GET /api/v1/support/timeline` | **Fort** (chemin identique) | Faible (URL différente : `/dsi/audit`) | Oui côté backend ; frontend à réaligner sur ce chemin |
| 5 | `POST /api/v1/commands/{id}/retry` | Non documenté (ni confirmé ni contredit) | Aucun (inconnu du frontend) | Backend ok tel quel ; à documenter dans docs/03 |
| 6 | Heartbeat device | Faible (payload ALG-03 non transmis) | Sans objet (pas un appel frontend) | Non — payload à étendre si besoin réel de RSSI/batterie |

**Recommandation** : les endpoints 1 et 4 sont les plus proches d'être connectables sans
redesign lourd. Les endpoints 2, 3 et 6 nécessitent des décisions produit/sécurité (pas
seulement techniques) avant d'écrire du code. Le domaine authentification (§8) est un
prérequis structurant qui conditionne une bonne partie du reste (RBAC sur 2, 3, 5) et
mérite d'être tranché en premier.
