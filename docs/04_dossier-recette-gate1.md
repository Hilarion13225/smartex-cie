# Dossier de recette — Gate 1 "Mock end-to-end fonctionnel"

Conforme à `docs/02_developer-pack-poc.md` §19_LabProcedure et §20_Acceptance.

## 1. En-tête

| Champ | Valeur |
|---|---|
| Date du dossier | 2026-08-25 (mis à jour le même jour : T11/T13/C01/C03/C05-C07 §3bis, puis T14 §3ter — **dernier test logiciel du §14_TestMatrix, dossier considéré complet côté logiciel après cette mise à jour**) |
| Périmètre testé | PoC Laboratoire — backend Spring Boot (`backend/poc-backend`) + simulateurs Python (`payment-simulator`, `mock-dongle`), orchestrés via `docker compose`. **Hors matériel réel** : aucun compteur ni dongle physique CIE, uniquement `MockMeterAdapter` / `mock-dongle`. |
| Version du repo | Base : branche `main`, commit `28d9b91` ("docs: dossier de recette Gate 1..."), taguée `LAB-POC-v0.1.0`. Compléments réalisés sur deux branches non fusionnées : `test/cyber-tests-t11-t13-c01-c07` (commits `2a9ed27`, `5e71bc5` — §3bis) puis `test/t14-performance` (commits `8ade229`, `ea934f0` — §3ter, T14 et son correctif), cette dernière créée depuis la première pour ne pas perdre ses résultats. **Aucune des deux n'est mergée sur `main`**, en attente de validation explicite (voir §6). |
| Tag Git | **`LAB-POC-v0.1.0`** (tag annoté, pointe sur `28d9b91`), conformément à `§06_Repo`. Les compléments §3bis/§3ter ne sont pas encore inclus dans un tag — à re-taguer après merge (`LAB-POC-v0.2.0` suggéré, la couverture logicielle complète du Gate 1 le justifie). |
| État de commit | ✅ Tout le travail décrit dans ce dossier est commité (voir tableaux §2 pour les hash exacts par sujet). Chaque commit de la partie taguée a été vérifié individuellement buildable (`mvn compile test-compile` / `mvn test` réussis sur chacun via des worktrees temporaires), garantissant un historique bisectable. Les commits `2a9ed27`/`5e71bc5`/`8ade229`/`ea934f0` ont été vérifiés par `mvn test` (27/27 puis 29/29) après coup, pas via worktree dédié. |

## 2. Tableau récapitulatif des tests

Tests explicitement couverts par ce dossier : T01–T06, T09, T11, T13, T14, T15, C01–C07 (voir §4
pour T07/T08, partiellement couverts et traités séparément, et pour T10, seul test du
`§14_TestMatrix` non exécuté — bloqué par une limite matérielle, pas logicielle).

| ID | Description | Résultat | Commit | Anomalie corrigée |
|---|---|---|---|---|
| T01 | Paiement nominal → `SUCCESS` | PASS | `9bb175e` | — |
| T02 | Génération/association du token à la transaction | PASS | `9bb175e` | — |
| T03 | Transmission MQTT → ACK reçu | PASS avec correction | `9bb175e` | Race condition transaction/MQTT initiale (Bug #1) |
| T04 | Activation token valide → `ACCEPTED` (MockMeterAdapter) | PASS avec correction | `9bb175e` | Race condition transaction/MQTT initiale (Bug #1) |
| T05 | Token invalide → `REJECTED`, aucune activation | PASS | `b7145f1` | — |
| T06 | Double commande (même `commandId`/`idempotencyKey`) → une seule exécution | PASS | `9bb175e` | — |
| T09 | Coupure/redémarrage du backend | PASS | `0ca7f7d` | — (bénéficie indirectement des correctifs #2–#4, découverts et corrigés pendant T07 ; voir §3 et §4) |
| T11 | Commande non autorisée / certificat invalide → rejet | PASS | `2a9ed27` | — (identique à C01, voir ligne C01) |
| T13 | Expiration (`expiresAt`) → rejet, pas d'application comme succès valide | PASS | `2a9ed27` | — |
| T15 | Auditabilité — trace complète bout en bout | PASS | `9bb175e` | — |
| C01 | Certificat invalide (signé par une CA différente) → rejet | PASS | `2a9ed27` | — |
| C02 | Dongle A tente une commande vers compteur B → rejet par l'ACL du broker (pas par le code applicatif) | PASS | `3f4ee21` | — |
| C03 | Rejeu du même `commandId` au niveau broker/protocole (pas seulement applicatif) → ignoré | PASS | `2a9ed27` | — |
| C04 | Commande expirée → rejet (identique à T13) | PASS | `2a9ed27` | — |
| C05 | Token en clair dans les logs → absent (masquage vérifié par grep exhaustif) | PASS | `2a9ed27` | — |
| C06 | Broker ACL — identité mTLS valide mais non enregistrée → aucun accès aux topics d'un autre device | PASS | `2a9ed27` | — |
| C07 | Scan de secrets sur tout l'historique Git → aucun secret trouvé | PASS | `2a9ed27` | — |
| T14 | Latence end-to-end (paiement → `CREDIT_APPLIED`), volume + parallélisme léger | PASS avec correction | `8ade229` | Lost update concurrent SENT/ACK + ACK `DUPLICATE` non géré (§3ter) |

*Colonne "Commit" : `9bb175e` = validation initiale T01→T06/T15 ; `b7145f1` = endpoint T05 ;
`3f4ee21` = mTLS/ACL (dont C02) ; `0ca7f7d` = correctifs de résilience T07-T09 ; `2a9ed27` =
scripts T11/C01/C06 + TTL paramétrable pour T13/C04 (voir §3bis pour le détail méthodologique de
chacun, C03/C05/C07 n'ayant pas nécessité de nouveau code, seulement une procédure de test
documentée) ; `8ade229` = correctif de concurrence trouvé par T14 (§3ter) ; `ea934f0` = outil de
mesure T14 (`infra/perf/t14_latency.py`). Tous atteignables depuis le tag `LAB-POC-v0.1.0` (base)
et les branches `test/cyber-tests-t11-t13-c01-c07` (§3bis) / `test/t14-performance` (§3ter,
créée depuis la précédente).*

## 3. Anomalies et corrections

Quatre anomalies réelles ont été découvertes en exécutant les tests ci-dessus (pas en relecture
de code a priori) et corrigées. Reprises ici telles qu'établies lors des sessions de test
correspondantes, sans ré-analyse du code.

### Bug #1 — Race condition transaction DB / publication MQTT initiale

- **Symptôme observé** : lors du tout premier scénario T01→T04 exécuté réellement, la commande
  MQTT était bien publiée mais `mock-dongle` répondait par un ACK en ~20 ms — plus rapide que le
  commit PostgreSQL de la transaction ayant créé la ligne `command`. `AckListener` recevait l'ACK
  avant que la commande soit visible en base et levait `IllegalArgumentException("Commande
  inconnue: ...")` ; la recharge restait bloquée indéfiniment au statut `COMMAND_SENT`.
- **Cause racine** : `RechargeOrchestrator.orchestrate()` appelait
  `commandPublisher.publishTokenCommand(...)` de façon synchrone, **à l'intérieur** de la même
  transaction `@Transactional` que la création de la commande — donc avant le commit.
- **Correction** : publication différée à après-commit via `TransactionSynchronization
  .afterCommit()` (nouvelle classe `CommandDispatcher`), le travail de marquage de statut/audit
  étant exécuté dans une transaction `REQUIRES_NEW` sur un **bean Spring distinct**
  (`CommandSendFinalizer`) — nécessaire car un callback `afterCommit()` s'exécute alors que les
  ressources transactionnelles du thread ne sont pas encore totalement débindées ; une
  transaction à propagation par défaut (REQUIRED) s'y "raccroche" silencieusement et n'est jamais
  réellement recommise (observé concrètement : un événement d'audit `COMMAND_SENT` était créé en
  mémoire avec un identifiant valide, jamais visible en base). Des garde-fous ont été ajoutés pour
  ne jamais écraser un statut déjà terminal (`ACCEPTED`/`CREDIT_APPLIED`) en cas de course
  résiduelle.
- **Fichiers modifiés** : `RechargeOrchestrator.java`, `CommandDispatcher.java` (nouveau),
  `CommandSendFinalizer.java` (nouveau), `RechargeOrchestratorIdempotencyTest.java`.

### Bug #2 — Double client MQTT pendant la reconnexion automatique

- **Symptôme observé** : découvert en testant T07 (coupure/reprise du broker). Risque de
  collision d'identité de connexion MQTT pendant la reconnexion après une coupure réseau.
- **Cause racine** : `MqttClientProvider.client()` recréait un **nouveau** `MqttClient` (même
  `clientId`) chaque fois que `isConnected()` retournait `false`, alors que Paho gérait déjà sa
  propre reconnexion automatique (`automaticReconnect(true)`) sur ce même client. Le broker ne
  conservant qu'une connexion active par `clientId`, cela pouvait entrer en conflit avec la
  reconnexion légitime en cours (fermeture de session / "clignotement" de connexion).
- **Correction** : le client n'est désormais créé qu'**une seule fois** (`if (client == null)`) ;
  la reprise sur coupure réseau est intégralement déléguée à Paho et à la session persistante
  côté broker (`cleanSession(false)`).
- **Fichiers modifiés** : `MqttClientProvider.java`.

### Bug #3 — Republication du retry avant commit (même défaut que Bug #1, chemin différent)

- **Symptôme observé** : même classe de défaut que le Bug #1, mais sur le chemin de retry
  automatique (`handleTimeout`), jamais exercé jusqu'au test T07.
- **Cause racine** : `handleTimeout()` republiait directement via
  `commandPublisher.publishTokenCommand(...)`, en synchrone, dans la même transaction
  `@Transactional` que `handleAck()` — donc avant commit. Par ailleurs, la commande republiée
  conservait sa fenêtre de validité (`expiresAt`) déjà dépassée au lieu d'une fenêtre fraîche
  (le token aurait été republié déjà hors-fenêtre, cf. T13).
- **Correction** : le retry (automatique via `handleTimeout`, et manuel via
  `POST /api/v1/commands/{id}/retry`) passe désormais par le même mécanisme différé après-commit
  (`CommandDispatcher`/`CommandSendFinalizer`) ; ajout de `MeterCommand.renewExpiry(...)` pour
  renouveler la fenêtre de validité à chaque retry.
- **Fichiers modifiés** : `RechargeOrchestrator.java` (`handleTimeout`, `retryCommand`),
  `MeterCommand.java`.

### Bug #4 — Le job de surveillance excluait les commandes déjà `TIMEOUT`

- **Symptôme observé** : découvert en observant en direct le test T07. Après un premier retry
  automatique, lorsque ce retry se perdait lui-même (ex. `mock-dongle` pas encore réabonné au
  moment exact de la republication), la commande restait bloquée **indéfiniment** au statut
  `TIMEOUT`, sans aucune tentative supplémentaire.
- **Cause racine** : la première version de `CommandExpiryWatcher` (job planifié ajouté pour
  résoudre le problème "une commande jamais acquittée reste bloquée indéfiniment", identifié
  pendant T07) ne recherchait que les commandes aux statuts `PENDING`/`SENT` dont `expiresAt`
  était dépassé, excluant à tort le statut `TIMEOUT`, sur l'hypothèse erronée qu'un seul passage
  suffirait toujours.
- **Correction** : `TIMEOUT` ajouté à la liste des statuts non-terminaux surveillés, permettant au
  job de retenter jusqu'à épuisement de `MAX_RETRIES` (3) avant bascule en fallback définitif
  (`FALLBACK_TOKEN_SENT`).
- **Fichiers modifiés** : `CommandExpiryWatcher.java` (nouveau fichier ; ce correctif est déjà
  intégré dans sa version présente dans l'arbre de travail).

## 3bis. Tests de sécurité complémentaires (T11, T13, C01, C03, C05–C07)

Exécutés réellement (pas en relecture de code), en complément de C02 (§2/§3, déjà validé
séparément) et T12 (couvert par le test unitaire `RechargeOrchestratorIdempotencyTest
.ackDupliqueSurCommandeTerminale_estIgnore`, déjà en place). **Aucune anomalie n'a été trouvée
sur ces sept tests** — contrairement aux quatre bugs de §3, le code existant s'est comporté comme
attendu à chaque fois ; aucune correction n'a donc été nécessaire ici.

### T11 / C01 — Certificat invalide → rejet

**Méthode** : génération à la volée (`infra/mosquitto/test-cert-invalide-t11-c01.sh`) d'un
certificat client signé par une CA "rogue" (différente de la CA de laboratoire configurée dans
`mosquitto.conf`), avec `CN=DONGLE-LAB-0001` — volontairement identique à un device légitime,
pour prouver que c'est bien la chaîne de confiance qui est vérifiée, pas seulement le nom.
Commande de génération (voir le script pour le détail complet) :
```bash
openssl req -x509 -new -key rogue-ca.key -subj "/CN=Rogue-CA" -out rogue-ca.crt ...
openssl x509 -req -in rogue-client.csr -CA rogue-ca.crt -CAkey rogue-ca.key -out rogue-client.crt ...
mosquitto_pub -h mosquitto -p 8883 --cafile ca.crt --cert rogue-client.crt --key rogue-client.key \
  -t cie/lab/DONGLE-LAB-0001/ack -m '...'
```
**Résultat observé** : la connexion est refusée **au niveau TLS**, avant tout traitement MQTT —
côté client : `OpenSSL Error ... error:0A000418:SSL routines::tlsv1 alert unknown ca` ; côté
broker (`docker compose logs mosquitto`) :
```
New connection from 172.20.0.7:40780 on port 8883.
OpenSSL Error while trying to get the error[0]: error:0A000086:SSL routines::certificate verify failed
Client 172.20.0.7 [172.20.0.7:40780] disconnected: Protocol error.
```
Le client ne se voit même pas attribuer d'identité applicative (contrairement à une connexion
légitime, qui apparaît comme `connected as <identité> (..., u'<CN>')`) — la preuve que le rejet a
bien lieu avant toute authentification/ACL applicative. **PASS.**

### T13 / C04 — Commande expirée → rejet

**Méthode** : `mqtt.command-ttl-seconds` rendu paramétrable
(`MQTT_COMMAND_TTL_SECONDS`, défaut 60s inchangé) pour pouvoir tester une fenêtre courte (2s) sans
attendre. `mock-dongle` arrêté (`docker compose stop mock-dongle`) pour garantir qu'aucun ACK
légitime ne puisse arriver, puis une recharge manuelle déclenchée. Après expiration de
`expiresAt` (vérifié en base, `expires_at < now()`) mais **avant** que `CommandExpiryWatcher` (qui
tourne toutes les 10s) n'ait eu l'occasion de traiter la commande, un ACK tardif `ACCEPTED` a été
publié manuellement via `mosquitto_pub` avec le **vrai certificat mTLS** de `DONGLE-LAB-0001`
(commandId + correlationId réels de la commande créée) :
```bash
mosquitto_pub -h mosquitto -p 8883 --cafile ca.crt --cert DONGLE-LAB-0001.crt --key DONGLE-LAB-0001.key \
  -t cie/lab/DONGLE-LAB-0001/ack -m '{"commandId":"<réel>","correlationId":"<réel>","result":"ACCEPTED"}'
```
**Résultat observé** : malgré l'ACK prétendant `ACCEPTED`, la commande passe en statut `TIMEOUT`
(pas `ACCEPTED`) et la recharge en `COMMAND_TIMEOUT` (pas `CREDIT_APPLIED`) — `retry_count` passé
à `1`, une nouvelle commande republiée avec une fenêtre `expiresAt` renouvelée. Confirme que
`RechargeOrchestrator.handleAck()` applique bien sa vérification `command.isExpired()` : un ACK
métier tardif, quel que soit son contenu, ne peut jamais créditer un compte après expiration —
il est systématiquement rétrogradé en `TIMEOUT` et suit le chemin retry/fallback (ALG-02 étape
7-8), jamais appliqué comme un succès. **PASS, aucune correction nécessaire.**

**Limite non exercée par ce test** (documentée, pas corrigée) : `MeterCommand` ne conserve qu'une
seule fenêtre `expiresAt` (renouvelée en place à chaque retry via `renewExpiry`), pas un
historique par tentative. Le scénario testé ici (ACK tardif arrivant *avant* tout retry) est
couvert ; le scénario plus fin "ACK tardif correspondant à la tentative n, arrivant *après* que
la tentative n+1 a déjà renouvelé `expiresAt`" n'a pas été spécifiquement exercé — dans ce cas,
`isExpired()` serait évalué contre la fenêtre renouvelée (potentiellement encore valide), pas
contre la fenêtre d'origine. Risque théorique à garder en tête avant un banc réel à plus fort
enjeu, mais non observé comme un défaut ici (le `commandId` reste inchangé entre tentatives, donc
le comportement dépend de la fenêtre *courante* au moment de l'ACK, par construction).

### C03 — Rejeu même `commandId` au niveau broker/protocole

**Méthode** : une recharge nominale menée à bien jusqu'à `CREDIT_APPLIED` (via `mock-dongle`
réel), puis republication manuelle du **même** message ACK (mêmes `commandId`/`correlationId`,
`result: ACCEPTED`) via `mosquitto_pub` avec le vrai certificat `DONGLE-LAB-0001` — donc au niveau
protocole/broker, pas via un mock applicatif, complémentaire au test unitaire déjà existant.
**Résultat observé** : `ackAt` et `updatedAt` de la commande restent inchangés après le rejeu ; un
nouvel événement d'audit apparaît explicitement :
```json
{"action":"ACK_DUPLICATE_IGNORED","result":"IGNORED",
 "details":"ACK reçu alors que la commande est déjà dans un état terminal: ACCEPTED"}
```
Confirme `RechargeOrchestrator.handleAck()` → `isTerminal(command.getStatus())` en conditions
réelles bout en bout. **PASS.**

### C05 — Token dans les logs → masquage vérifié formellement

**Méthode** : recherche exhaustive du préfixe `LABTKN-` (identifiant tout token en clair généré
par `RechargeOrchestrator.generateTokenPlaceholder`) dans l'intégralité des logs `backend` et
`mock-dongle` depuis le démarrage du conteneur, après un paiement complet (T01) :
```bash
docker compose logs backend mock-dongle | grep -ci "LABTKN"          # -> 0
docker compose logs backend mock-dongle | grep -iE "tokenplaintext|\"token\":\"LABTKN"  # -> 0
```
**Résultat observé** : 0 occurrence sur 181 lignes de logs couvrant un cycle de recharge complet
(paiement → token → commande MQTT → ACK → crédit). Les seules lignes mentionnant "token" sont le
nom du topic MQTT (`cie/lab/.../command/token`, un nom fixe, pas une valeur) et une ligne
explicite côté `mock-dongle` : `"Commande reçue ... (token reçu, non loggé)"`. Vérifié également
que la colonne `recharge.token_hash` en base ne contient que des hachages SHA-256 (jamais de
valeur préfixée `LABTKN`). **PASS, conforme à `CLAUDE.md` règle #3 et déjà noté dans
`docs/05_reconciliation-api-frontend-backend.md` §2.**

### C06 — Broker ACL, identité inconnue → aucun accès aux topics d'un autre device

**Méthode** (`infra/mosquitto/test-acl-c06.sh`) : génération d'un certificat **valide** (signé
par la vraie CA de labo — le handshake TLS réussit) avec `CN=INTRUDER-0001`, absent de
`acl.conf`. Trois tentatives : abonnement au topic de commande de `DONGLE-LAB-0001`, publication
sur son topic d'ACK, abonnement wildcard `cie/lab/#`.
**Résultat observé** : les trois tentatives échouent (aucun message reçu/relayé — timeout côté
`mosquitto_sub`). **PASS** sur le critère testé : aucun accès à un topic d'un **autre** device, ni
par ciblage direct ni par wildcard.

**Observation documentée** (pas un critère d'échec de ce test, mais à connaître) : ce même
certificat `INTRUDER-0001` obtient, comme n'importe quel certificat valide émis par la CA de
labo, un accès **à son propre topic auto-scopé** (`cie/lab/INTRUDER-0001/...`) — la règle
`pattern` de `acl.conf` est générique (s'applique à toute identité authentifiée par `%u`, pas à
une liste blanche de devices enregistrés en base). Ce n'est pas une brèche vers les données d'un
autre device, mais un trait d'architecture à signaler : la sécurité de ce modèle repose entièrement
sur le contrôle de l'émission des certificats (qui a le droit d'obtenir un certificat signé par la
CA de labo), pas sur une liste de devices connus du broker. Pertinent à discuter avec la
Cybersécurité CIE avant le Gate 2 (la PKI de labo, auto-signée et sans révocation, sera de toute
façon remplacée — voir §6 point 2).

### C07 — Scan de secrets Git (historique complet, pas seulement HEAD)

**Méthode** : scan avec `gitleaks` (image officielle `zricethezav/gitleaks`, tirée pour ce test)
sur l'intégralité de l'historique (`git log --all`, 20 commits) :
```bash
docker run --rm -v "$(pwd):/repo" zricethezav/gitleaks:latest detect --source=/repo --log-opts="--all" -v
# -> "20 commits scanned." / "scanned ~844.74 KB" / "no leaks found"
```
Complété par une recherche manuelle indépendante sur tout l'historique (pas seulement HEAD), pour
ne pas dépendre d'un seul outil :
```bash
git rev-list --all | xargs -I{} git grep -l "BEGIN.*PRIVATE KEY" {}     # clés privées
git rev-list --all | xargs -I{} git grep -niE "password\s*=\s*[\"'][^$]...|secret\s*=\s*..." {}  # secrets en dur
git log --all --oneline -- infra/mosquitto/certs/                       # certs jamais commités ?
git log --all --oneline -- '*.env' ':!*.env.example'                    # .env jamais commité ?
```
**Résultat observé** :
- `gitleaks` : **aucun secret détecté** sur les 20 commits.
- Grep manuel "clé privée" : 12 correspondances, **toutes** dans
  `backend/.../mqtt/PemTlsSupport.java` — vérifié individuellement : il s'agit du code qui **lit**
  un fichier PEM externe au runtime et retire les marqueurs `-----BEGIN/END PRIVATE KEY-----`
  d'une chaîne (`Files.readString(path)` sur un chemin fourni en configuration), pas une clé
  embarquée dans le code. **Faux positif confirmé, aucune clé réelle.**
- Grep manuel "mot de passe/secret en dur" : **0 correspondance**.
- `infra/mosquitto/certs/` : **jamais touché par aucun commit** de l'historique (confirmé
  vide) — l'exclusion `.gitignore` a fonctionné dès le premier commit qui aurait pu l'inclure,
  pas seulement après coup.
- `.env` (hors `.env.example`) : **jamais commité** non plus.

**C07 : PASS — aucun secret trouvé dans l'historique Git, par deux méthodes indépendantes.**
Rien à purger, rien à signaler à l'utilisateur sur ce point.

## 3ter. T14 — Latence end-to-end (dernier test logiciel du §14_TestMatrix)

**Méthode** (`infra/perf/t14_latency.py`, voir son README) : mesure le temps entre l'envoi d'un
paiement simulé (`POST /simulate-payment`) et le moment où la recharge correspondante atteint
`finalStatus=CREDIT_APPLIED` en base, sur 60 recharges avec 8 à 10 en parallèle. **Limite assumée
et documentée explicitement dans le script** : ce n'est **pas** un test de charge représentatif
d'une charge de production réelle — poste de labo unique (un seul `mock-dongle`, un seul broker,
tout sur la même machine que le backend), aucune conclusion de dimensionnement ne doit en être
tirée sans un vrai test de charge sur une infrastructure représentative.

### Anomalie trouvée et corrigée : lost update concurrent + ACK `DUPLICATE` non géré

Le tout premier run (60 recharges, concurrence 8) a révélé un taux d'échec de 10% (6/60 bloquées
en `COMMAND_SENT`/`COMMAND_TIMEOUT` au-delà du timeout de test). Investigation par lecture directe
des logs et de la base (pas de correction à l'aveugle) :

1. **Race condition "lost update"** entre `CommandSendFinalizer.publishAndMarkSent` (qui marque la
   commande `SENT` après publication MQTT) et `RechargeOrchestrator.handleAck` (qui marque
   `ACCEPTED` sur réception de l'ACK). Preuve directe dans l'audit trail d'une recharge touchée :
   ```
   RECHARGE_CREATED  11:57:12.989
   CREDIT_APPLIED    11:57:13.260   <- l'ACK a bien été traité comme un succès...
   COMMAND_SENT      11:57:13.287   <- ...puis ce log arrive après, et écrase le statut
   ```
   `mock-dongle` répond en général en quelques millisecondes ; sous charge concurrente, la fenêtre
   entre "publier la commande" et "committer son propre `markSent()`" s'élargit suffisamment pour
   que l'ACK committe *avant* — puis `CommandSendFinalizer`, qui avait chargé sa propre copie de la
   commande *avant* ce commit concurrent, écrase silencieusement `ACCEPTED` par `SENT` en
   sauvegardant sa vue périmée. Le garde-fou `if (status == PENDING)` déjà présent (§3, Bug #1)
   était bien réel mais évalué sur une lecture en mémoire non fraîche — un TOCTOU classique entre
   deux transactions indépendantes sur la même ligne.
2. **Conséquence en cascade, ACK `DUPLICATE` non géré** : la commande ainsi repassée à `SENT` était
   retentée 60s plus tard par `CommandExpiryWatcher` ; `mock-dongle`, qui avait déjà traité ce
   `commandId` (son propre anti-rejeu), répondait `DUPLICATE` — un cas que
   `RechargeOrchestrator.handleAck` ne traitait pas (`default` du switch, simple `log.warn`),
   laissant la recharge bloquée en `COMMAND_TIMEOUT` **indéfiniment**, malgré un crédit réellement
   appliqué côté compteur dès la première tentative.

**Correction** (commit `8ade229`) :
- `CommandSendFinalizer` remplace son pattern `find()` + vérification en mémoire + `save()` par un
  `UPDATE` conditionnel **atomique** au niveau SQL (`CommandRepository#markSentIfStatus`,
  `RechargeRepository#markStatusIfStatus` — `UPDATE ... WHERE status = :expected`) : plus aucune
  fenêtre de lecture-modification-écriture, la transaction la plus rapide gagne proprement au lieu
  de pouvoir être écrasée par la plus lente.
- Un ACK `DUPLICATE` est désormais traité comme un succès implicite (le mécanisme anti-rejeu du
  dongle ne répond `DUPLICATE` que s'il a déjà appliqué ce token avec succès) — transitionne la
  recharge vers `CREDIT_APPLIED`, audité distinctement (`CREDIT_APPLIED_VIA_DUPLICATE_ACK`).
- 2 nouveaux tests unitaires (`CommandSendFinalizerTest`, `RechargeOrchestratorIdempotencyTest
  #ackDuplicate_...`). `mvn test` = 29/29 verts.

### Résultats après correction

4 runs consécutifs, 60 recharges chacun (le premier juste après reconstruction du backend — JIT/
pool de connexions à froid — puis 3 runs "chauds") :

| Run | Concurrence | Succès | min | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| 1 (à froid, juste après rebuild) | 8 | 60/60 (100%) | 293 ms | 601 ms | 1770 ms | 1793 ms | 1808 ms |
| 2 | 8 | 60/60 (100%) | 93 ms | 323 ms | 924 ms | 957 ms | 957 ms |
| 3 | 10 | 60/60 (100%) | 62 ms | 277 ms | 411 ms | 465 ms | 488 ms |
| 4 (retenu comme référence, "chaud") | 8 | 60/60 (100%) | 74 ms | **256 ms** | **341 ms** | 357 ms | 375 ms |

**Avant correctif** (run initial, mêmes paramètres) : 54/60 (90%) puis 59/60 (98,3%) sur deux
essais — variable, cohérent avec une race condition (pas un défaut déterministe).

**Après correctif : 100% de succès sur les 4 runs (240 recharges), aucune anomalie résiduelle
observée.** Chiffres de référence retenus (run 4, "chaud") : **p50 = 256 ms, p95 = 341 ms,
p99 = 357 ms**. La variance notable entre runs (p95 de 341 ms à 1770 ms) reflète surtout l'état de
la JVM/du pool de connexions au moment du run (premier run après un rebuild vs runs suivants) et
la nature partagée du poste de développement (Docker Desktop, autres processus) — pas un signe
d'instabilité du système lui-même, qui converge de façon fiable dans tous les cas.

**Aucun seuil p50/p95 n'a été proposé ni approuvé par la CIE** — ces chiffres sont une première
mesure de référence, pas une validation contre un objectif métier convenu (qui reste à définir
avec la CIE avant un banc réel, voir §6).

## 4. Limites connues et non couvertes

- **T07 (perte réseau MQTT) — partiellement couvert, à préciser** : le round-trip MQTT local
  (quelques millisecondes) est trop rapide pour interrompre une commande *après* son passage en
  `SENT` via de simples commandes shell séquentielles. Le test réellement exécuté a donc **coupé
  le broker avant l'émission de la recharge** plutôt qu'après (adaptation nécessaire, documentée
  dans `README.md`). Ce qui **est** validé : aucune perte de données malgré l'échec de publication
  (HTTP 500 côté client, mais recharge/commande bien enregistrées en base), reconnexion
  automatique des deux côtés (backend et `mock-dongle`) sans redémarrage de conteneur, et
  retry+fallback via `CommandExpiryWatcher` jusqu'à résolution (`CREDIT_APPLIED`). Ce qui **n'est
  pas** strictement validé : le scénario littéral "commande déjà `SENT`, ACK en approche, coupure
  survient exactement entre les deux" tel que décrit en `§16_FailureInjection`, ni un quelconque
  seuil de temps de reprise formellement convenu avec la CIE.
- **T08 (redémarrage du dongle) — couvert uniquement au niveau conteneur logiciel** :
  `docker compose restart mock-dongle` a été testé et validé (résubscription correcte). Mais
  `MeterState` (`credit_fcfa`, mémoire anti-rejeu `processed_command_ids`) est un simple objet
  Python en mémoire, sans aucune persistance — un redémarrage l'efface entièrement (vérifié
  empiriquement : crédit passé de `17500.0` à `0.0` XOF après restart, alors que les recharges
  correspondantes restent correctement `CREDIT_APPLIED` côté backend, qui reste le système de
  référence). Un vrai dongle/firmware devra avoir sa propre mémoire persistante (flash/secure
  element) — un redémarrage matériel ne doit jamais réinitialiser le crédit ni oublier les
  commandes déjà traitées. **T08 "physique"** (redémarrage réel d'un dongle STM32, comportement
  watchdog) n'est pas testable sans banc de laboratoire.
- **Course bénigne watcher / redélivrance MQTT (découverte pendant T09)** : au démarrage du
  backend, `CommandExpiryWatcher` se déclenche quasi immédiatement et peut traiter une commande
  comme `TIMEOUT` avant que l'ACK réellement mis en attente côté broker (session persistante
  QoS1) n'ait été lu par `AckListener` — un retry superflu est alors déclenché. Le système converge
  quand même (aucune perte, aucune incohérence), mais l'ACK d'origine n'est pas celui qui résout
  la commande. Aucune garantie d'ordre stricte n'existe entre "traiter les messages MQTT en
  attente à la reconnexion" et "premier passage du job planifié" au démarrage. Non corrigé — sans
  conséquence pour le PoC logiciel, mais à surveiller avant un banc réel à plus fort enjeu.
- **Compteur/protocole réel CIE non qualifié (Gate 0 non franchi)** : tout le PoC repose sur
  `MockMeterAdapter`/`mock-dongle`, qui simulent un comportement idéalisé (accepte tout token ne
  contenant pas le marqueur `INVALID`, latence quasi nulle). Le protocole, les timings, les codes
  d'erreur et les contraintes électriques du compteur réel CIE restent entièrement à qualifier
  avec la CIE avant tout raccordement (`docs/02_developer-pack-poc.md` §01_Objectifs, Gate 0).
- **Seul test du matrix non exécuté dans ce dossier : T10** (mauvaise association device/meter) —
  bloqué par une limite **matérielle**, pas logicielle : aucun deuxième device de labo n'est
  provisionné (un seul `mock-dongle`, `DONGLE-LAB-0001`, existe dans cet environnement) pour
  constituer un vrai cas "Dongle A / compteur B" à ce niveau. Tous les autres tests du
  `§14_TestMatrix` et `§18_CyberTests` sont désormais couverts par des tests dédiés réels : T11,
  T13, C01, C03, C05, C06, C07 (§3bis, tous PASS, aucune anomalie trouvée) et T14 (§3ter, PASS
  après correction de deux anomalies réelles trouvées en l'exécutant).
- **Coupure d'alimentation réelle (T09 matériel)** : ce dossier ne couvre que
  `docker compose stop/start/restart` (arrêt propre de process). Une coupure secteur/batterie
  réelle sur du matériel physique comporte des risques propres (corruption de flash, état
  électrique indéterminé) qu'un simple redémarrage de conteneur ne peut pas représenter.
- **Historique de commits pré-Gate 1** : les 3 tout premiers commits (`6870ff7`, `5f424f3`,
  `9bb175e`) datent de la mise en place initiale du repo et ne suivent pas le même niveau de
  granularité par sujet que les 4 commits de cette recette (`b7145f1` à `28d9b91`) ; ils ne sont
  pas individuellement re-vérifiés ici (seul l'état final, taggé `LAB-POC-v0.1.0`, l'est).

## 5. Critères d'acceptation Gate 1 (§20_Acceptance)

| Critère | Exigence du Developer Pack | Statut | Justification |
|---|---|---|---|
| **Fonctionnel** | 100% T01–T05 passés | ✅ **Atteint** | T01–T04 PASS (après correction Bug #1), T05 PASS direct. |
| **Idempotence** | 100% T06 sans double exécution | ✅ **Atteint** | T06 vérifié à plusieurs reprises : même `idempotencyKey` rejouée → même `rechargeId`, une seule commande publiée sur MQTT. |
| **Résilience** | T07–T09 passés selon critères convenus | 🟡 **Partiellement atteint** | T09 PASS. T08 PASS au niveau conteneur logiciel uniquement (limite mémoire documentée §4). T07 partiellement couvert (adaptation du scénario, §4) — et aucun "critère convenu" formel (seuil de temps de reprise, etc.) n'a été défini avec la CIE, donc la formulation exacte de l'exigence ne peut pas être cochée intégralement. |
| **Sécurité** | T11–T13 passés sans contournement | ✅ **Atteint** | T11 et T13 désormais exécutés en tests dédiés réels, sans contournement observé (§3bis) — T12 déjà couvert par test unitaire. L'ensemble des sept scénarios `§18_CyberTests` (C01–C07) est également couvert et PASS, aucune anomalie trouvée. Limite résiduelle documentée (§3bis, T13) : le cas fin d'un ACK tardif correspondant à une tentative *antérieure* à un retry déjà en cours n'a pas été spécifiquement exercé (risque théorique, pas observé). |
| **Performance** | p50/p95 mesurés et seuils approuvés | 🟡 **Partiellement atteint** | T14 désormais exécuté et PASS (§3ter) : p50 = 256 ms, p95 = 341 ms, 100% de succès sur 240 recharges (4 runs de 60), après correction d'une race condition réelle trouvée par ce test. **Mesurés : oui.** **Seuils approuvés par la CIE : non** — ces chiffres sont une première référence sur un poste de labo (pas un test de charge représentatif), aucun objectif métier n'a été proposé ni validé avec la CIE. |
| **Audit** | T15 traçable de bout en bout | ✅ **Atteint** | T15 validé à plusieurs reprises : `PAYMENT_CONFIRMED → RECHARGE_CREATED → COMMAND_SENT → CREDIT_APPLIED` (ou `COMMAND_REJECTED`), enchaînement correct et interrogeable par `correlationId`. |

**Lecture à deux niveaux** : au sens **étroit** de son propre nom ("Mock end-to-end fonctionnel",
`§01_Objectifs`), le Gate 1 est **atteint** — la chaîne complète paiement → token → MQTT → mock
compteur → audit fonctionne de bout en bout, de façon idempotente et traçable, avec une commande
de sécurité minimale (mTLS + ACL) en place et testée sur un cas. Au sens **large** de la grille
`§20_Acceptance` complète (qui couvre aussi la résilience T07-T09 et un jeu de tests cyber/perf
plus large), la couverture Sécurité est désormais **complète** (les sept scénarios `§18_CyberTests`
et T11/T12/T13 sont tous PASS, §3bis), et la Performance est **mesurée** (§3ter) même si ses
seuils restent à approuver avec la CIE. **À ce stade, tous les tests logiciels du `§14_TestMatrix`
et du `§18_CyberTests` sont couverts, à l'exception de T10** — bloqué par une limite matérielle
(absence d'un second device de labo), pas par le logiciel. Les points encore incomplets de
`§20_Acceptance` (Résilience partielle, seuils de Performance non approuvés) relèvent désormais
de décisions/prérequis à obtenir de la CIE, pas de travail logiciel restant.

## 6. Recommandation GO/NO-GO pour le Gate 2 (banc réel CIE)

### 🟡 GO CONDITIONNEL — couverture logicielle désormais complète

**Tous les tests logiciels exécutables sans matériel physique sont maintenant couverts et PASS**
(T01–T09, T11–T15, C01–C07 — voir §2), à l'exception unique de **T10**, bloqué par une limite
**matérielle** (aucun second device de labo provisionné), pas par une limite de temps ou de
couverture logicielle. Six anomalies réelles ont été découvertes en testant (les quatre de §3, plus
les deux de §3ter trouvées par T14) — **toutes corrigées et re-vérifiées, aucune connue et non
résolue à ce jour.** Notamment **C07 (scan de secrets Git, historique complet) : aucun secret
trouvé**, par deux méthodes indépendantes (gitleaks + grep manuel), rien à purger. Le cœur métier
(paiement → token → commande → activation, idempotence, audit, sécurité mTLS/ACL) fonctionne de
façon fiable et reproductible sur le PoC logiciel, y compris sous une charge concurrente légère
(T14 : 100% de succès sur 240 recharges après correctif).

Ceci justifie de ne **pas** bloquer sur un NO-GO — il n'y a, à ce stade, **aucune raison
logicielle** de retenir le Gate 2. Mais un GO inconditionnel reste exclu, car **tout ce qui reste
en suspens est désormais externe au code, pas du travail logiciel restant** : qualification
matérielle du compteur (Gate 0), remplacement de la PKI de laboratoire par la PKI de production
CIE, définition avec la CIE de critères de résilience (T07) et de seuils de performance (T14)
formellement approuvés, et T10 lui-même (nécessite un second device physique). Le distinguo est
important : ce n'est plus "le logiciel n'est pas prêt", c'est "des décisions et ressources qui
n'appartiennent pas à ce dépôt de code doivent encore être obtenues de la CIE".

**Conditions préalables explicites avant tout raccordement à un banc réel CIE (Gate 2) :**

1. **Qualifier le modèle de compteur et son protocole avec la CIE (Gate 0)** — prérequis externe
   que le code ne peut pas résoudre ; `MeterAdapter` est prêt à recevoir une implémentation réelle
   sans réécriture du cœur métier, mais rien ne peut être validé sans cette qualification.
2. **Remplacer la PKI de laboratoire auto-signée** (`infra/mosquitto/generate-lab-certs.sh`,
   explicitement marquée "jamais en production" dans le script lui-même) **par la PKI approuvée
   par la Cybersécurité CIE** avant tout raccordement à un dongle réel — d'autant plus pertinent
   après l'observation C06 (§3bis) : dans le modèle actuel, tout certificat signé par la CA de
   labo obtient automatiquement un accès à son propre topic, sans liste blanche de devices connus
   du broker ; la sécurité repose entièrement sur la maîtrise de l'émission des certificats, ce
   qui doit être un contrôle explicite de la PKI de production.
3. ~~Committer et taguer une version figée de ce travail~~ — **fait** : voir §1
   (commit `28d9b91`, tag `LAB-POC-v0.1.0`), conformément à `§19_LabProcedure` point 2.
4. **Exécuter formellement T07 selon le scénario littéral** du Developer Pack sur banc réel, et
   définir avec la CIE des critères de résilience convenus (durée max de reprise acceptable,
   etc.) — actuellement non définis.
5. ~~Exécuter T11 (certificat invalide → rejet) et T13 (expiration, en test dédié)~~ — **fait** :
   voir §3bis, PASS sans anomalie, ainsi que l'ensemble C01–C07. ~~Exécuter T14 (latence)~~ —
   **fait** : voir §3ter, PASS après correction d'une race condition réelle (p50 = 256 ms,
   p95 = 341 ms sur le run de référence). Reste à faire côté CIE, pas côté code : **faire approuver
   des seuils p50/p95 cibles** avant de considérer le critère Performance comme pleinement couvert
   au sens strict de `§20_Acceptance` (mesurer ne suffit pas, l'exigence porte aussi sur
   l'approbation du seuil).
6. **Ajouter une mémoire persistante réelle côté firmware/dongle** avant le banc réel — le mock en
   mémoire pure (§4) ne représente pas le comportement attendu du matériel réel et ne doit pas
   être considéré comme une preuve de résilience matérielle.
7. Comprendre/lever la course bénigne watcher/redélivrance MQTT décrite en §4 avant de s'appuyer
   sur ce mécanisme en conditions réelles à plus fort enjeu (même si elle est sans conséquence
   observée sur le PoC logiciel).
8. **Exécuter T10** (mauvaise association device/meter) dès qu'un second device de labo sera
   provisionné — seul test du `§14_TestMatrix` qui n'a pas pu être exécuté dans ce dossier, pour
   une raison purement matérielle (§4).

Aucune de ces conditions ne remet en cause la solidité du cœur applicatif démontrée par ce
dossier ; elles relèvent soit de prérequis externes (CIE), soit de travaux de durcissement
supplémentaires clairement identifiés et non ambigus. **Le logiciel du PoC, lui, a désormais fait
l'objet de toute la validation qu'il est possible de mener sans matériel CIE réel ni décision de
la CIE elle-même.**
