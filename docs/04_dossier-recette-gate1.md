# Dossier de recette — Gate 1 "Mock end-to-end fonctionnel"

Conforme à `docs/02_developer-pack-poc.md` §19_LabProcedure et §20_Acceptance.

## 1. En-tête

| Champ | Valeur |
|---|---|
| Date du dossier | 2026-08-25 |
| Périmètre testé | PoC Laboratoire — backend Spring Boot (`backend/poc-backend`) + simulateurs Python (`payment-simulator`, `mock-dongle`), orchestrés via `docker compose`. **Hors matériel réel** : aucun compteur ni dongle physique CIE, uniquement `MockMeterAdapter` / `mock-dongle`. |
| Version du repo | Branche `main`, commit **`28d9b91`** ("docs: dossier de recette Gate 1..."), historique complet visible via `git log --oneline` (4 commits atomiques par sujet au-dessus de `9bb175e` : T05, mTLS/ACL, résilience T07-T09, dossier de recette). |
| Tag Git | **`LAB-POC-v0.1.0`** (tag annoté, pointe sur `28d9b91`), conformément à `§06_Repo`. |
| État de commit | ✅ Tout le travail décrit dans ce dossier est commité et taggé (voir tableau §2 pour les hash exacts par sujet). Chaque commit a été vérifié individuellement buildable (`mvn compile test-compile` / `mvn test` réussis sur chacun via des worktrees temporaires), garantissant un historique bisectable. |

## 2. Tableau récapitulatif des tests

Tests explicitement couverts par ce dossier : T01–T06, T09, T15, C02 (voir §4 pour T07/T08,
partiellement couverts et traités séparément, et pour la liste des tests non exécutés).

| ID | Description | Résultat | Commit | Anomalie corrigée |
|---|---|---|---|---|
| T01 | Paiement nominal → `SUCCESS` | PASS | `9bb175e` | — |
| T02 | Génération/association du token à la transaction | PASS | `9bb175e` | — |
| T03 | Transmission MQTT → ACK reçu | PASS avec correction | `9bb175e` | Race condition transaction/MQTT initiale (Bug #1) |
| T04 | Activation token valide → `ACCEPTED` (MockMeterAdapter) | PASS avec correction | `9bb175e` | Race condition transaction/MQTT initiale (Bug #1) |
| T05 | Token invalide → `REJECTED`, aucune activation | PASS | `b7145f1` | — |
| T06 | Double commande (même `commandId`/`idempotencyKey`) → une seule exécution | PASS | `9bb175e` | — |
| T09 | Coupure/redémarrage du backend | PASS | `0ca7f7d` | — (bénéficie indirectement des correctifs #2–#4, découverts et corrigés pendant T07 ; voir §3 et §4) |
| T15 | Auditabilité — trace complète bout en bout | PASS | `9bb175e` | — |
| C02 | Dongle A tente une commande vers compteur B → rejet par l'ACL du broker (pas par le code applicatif) | PASS | `3f4ee21` | — |

*Colonne "Commit" : `9bb175e` = validation initiale T01→T06/T15 ; `b7145f1` = endpoint T05 ;
`3f4ee21` = mTLS/ACL (dont C02) ; `0ca7f7d` = correctifs de résilience T07-T09. Tous atteignables
depuis le tag `LAB-POC-v0.1.0`.*

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
- **Autres tests du matrix non exécutés dans ce dossier** : T10 (mauvaise association
  device/meter), T11 (commande non autorisée / certificat invalide → rejet), T13 (expiration en
  tant que test dédié — le mécanisme `expiresAt`/`renewExpiry` est exercé indirectement pendant
  T07 mais n'a pas été validé isolément), T14 (latence e2e p50/p95 — **jamais mesurée**, aucune
  instrumentation de métriques de type `activation_latency_ms` n'est en place), C01/C03/C04/C05
  (masquage du token — observé empiriquement dans tous les logs consultés, jamais en clair, mais
  sans test automatisé dédié)/C07 (scan de secrets Git — non exécuté formellement ; les
  certificats de labo sont exclus via `.gitignore` mais aucun outil type gitleaks n'a été lancé).
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
| **Sécurité** | T11–T13 passés sans contournement | ❌ **Non atteint à ce stade** | T11 et T13 non exécutés en tant que tests dédiés (§4). C02 (isolation par device via ACL broker) est en revanche validé et constitue une preuve de sécurité solide, mais il ne fait pas partie de la liste stricte T11–T13 de ce critère. La mTLS/ACL est implémentée et fonctionnelle, mais la couverture de test cyber au sens de `§18_CyberTests` reste incomplète (seul C02 sur sept scénarios). |
| **Performance** | p50/p95 mesurés et seuils approuvés | ❌ **Non atteint** | T14 jamais exécuté. Aucune mesure de latence n'a été faite, aucune métrique `activation_latency_ms` n'est instrumentée. Aucun seuil n'a été proposé ni approuvé par la CIE. |
| **Audit** | T15 traçable de bout en bout | ✅ **Atteint** | T15 validé à plusieurs reprises : `PAYMENT_CONFIRMED → RECHARGE_CREATED → COMMAND_SENT → CREDIT_APPLIED` (ou `COMMAND_REJECTED`), enchaînement correct et interrogeable par `correlationId`. |

**Lecture à deux niveaux** : au sens **étroit** de son propre nom ("Mock end-to-end fonctionnel",
`§01_Objectifs`), le Gate 1 est **atteint** — la chaîne complète paiement → token → MQTT → mock
compteur → audit fonctionne de bout en bout, de façon idempotente et traçable, avec une commande
de sécurité minimale (mTLS + ACL) en place et testée sur un cas. Au sens **large** de la grille
`§20_Acceptance` complète (qui couvre aussi la résilience T07-T09 et un jeu de tests cyber/perf
plus large), la couverture est **incomplète** sur Sécurité et Performance, comme détaillé ci-dessus.

## 6. Recommandation GO/NO-GO pour le Gate 2 (banc réel CIE)

### 🟡 GO CONDITIONNEL

Aucune anomalie critique de sécurité ou d'intégrité n'est connue et non résolue : les quatre
anomalies réelles découvertes en testant (§3) ont toutes été corrigées et re-vérifiées. Le cœur
métier (paiement → token → commande → activation, idempotence, audit) fonctionne de façon fiable
et reproductible sur le PoC logiciel. Ceci justifie de ne **pas** bloquer sur un NO-GO. Mais la
couverture Sécurité/Performance de `§20_Acceptance` reste incomplète (§5), et plusieurs
prérequis externes au code (qualification matérielle, PKI de production) ne peuvent être résolus
que par la CIE — ce qui exclut un GO inconditionnel.

**Conditions préalables explicites avant tout raccordement à un banc réel CIE (Gate 2) :**

1. **Qualifier le modèle de compteur et son protocole avec la CIE (Gate 0)** — prérequis externe
   que le code ne peut pas résoudre ; `MeterAdapter` est prêt à recevoir une implémentation réelle
   sans réécriture du cœur métier, mais rien ne peut être validé sans cette qualification.
2. **Remplacer la PKI de laboratoire auto-signée** (`infra/mosquitto/generate-lab-certs.sh`,
   explicitement marquée "jamais en production" dans le script lui-même) **par la PKI approuvée
   par la Cybersécurité CIE** avant tout raccordement à un dongle réel.
3. ~~Committer et taguer une version figée de ce travail~~ — **fait** : voir §1
   (commit `28d9b91`, tag `LAB-POC-v0.1.0`), conformément à `§19_LabProcedure` point 2.
4. **Exécuter formellement T07 selon le scénario littéral** du Developer Pack sur banc réel, et
   définir avec la CIE des critères de résilience convenus (durée max de reprise acceptable,
   etc.) — actuellement non définis.
5. **Exécuter T11 (certificat invalide → rejet) et T13 (expiration, en test dédié)**, et
   idéalement T14 (latence, après instrumentation de métriques `activation_latency_ms`), avant de
   considérer les critères Sécurité et Performance comme couverts.
6. **Ajouter une mémoire persistante réelle côté firmware/dongle** avant le banc réel — le mock en
   mémoire pure (§4) ne représente pas le comportement attendu du matériel réel et ne doit pas
   être considéré comme une preuve de résilience matérielle.
7. Comprendre/lever la course bénigne watcher/redélivrance MQTT décrite en §4 avant de s'appuyer
   sur ce mécanisme en conditions réelles à plus fort enjeu (même si elle est sans conséquence
   observée sur le PoC logiciel).

Aucune de ces conditions ne remet en cause la solidité du cœur applicatif démontrée par ce
dossier ; elles relèvent soit de prérequis externes (CIE), soit de travaux de durcissement
supplémentaires clairement identifiés et non ambigus.
