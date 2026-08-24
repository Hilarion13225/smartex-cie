# CIE Smart Retrofit Metering — Backend

## Contexte
Plateforme de retrofit pour compteurs prépayés de la CIE (Côte d'Ivoire) : ajouter connectivité
et pilotage à distance (suivi conso, alerte crédit faible, télé-recharge) **sans remplacer le
parc de compteurs existant**. Un dongle/module retrofit se branche sur le compteur existant
(protocole/interface à qualifier par modèle) ; le backend orchestre paiement → token → commande
→ compteur → preuve d'audit.

Deux niveaux de portée existent dans la documentation source (voir `/docs`) :
- **PoC Laboratoire** (portée actuelle) : prouver le flux end-to-end en environnement contrôlé,
  avec un compteur simulé (`MockMeter`), avant tout accès au laboratoire CIE.
- **Architecture V2 / cible production** : 6 microservices Java + 5 services Node.js (voir
  `docs/03_architecture-v2.md`). Le PoC est construit pour évoluer vers ce V2 sans réécriture
  complète du cœur transactionnel.

## Scope de cette phase : Backend PoC Laboratoire

Construire les services backend suivants (Java 21 / Spring Boot), avec un **Mock Meter** en
attendant l'accès au compteur réel CIE :

| Service | Rôle |
|---|---|
| `payment-service` | Reçoit un paiement simulé, crée une transaction unique (`transactionId`) |
| `token-command-service` | Associe token ↔ compteur ↔ dongle, crée un `commandId` unique, idempotent |
| `device-service` | Identité, statut, dernière télémétrie des dongles |
| `audit-service` | Journal append-only de tous les événements (paiement, commande, ACK, erreurs) |
| `mqtt-gateway` | Publie les commandes en QoS 1 vers `cie/lab/{dongleId}/command/token`, corrèle les ACK |
| `meter-adapter` (interface) | `enter_token()`, `read_status()`, `read_credit()`, `healthcheck()` — implémentation `MockMeter` en premier, adapter réel après qualification CIE |

Hors scope pour l'instant : firmware STM32 du dongle (fourni/testé par SMARTEX), intégration PSP
réelle, certification réglementaire, remplacement/qualification physique du compteur.

## Règles non négociables

1. **Idempotence stricte** : `transactionId` et `commandId` uniques ; aucune double exécution
   même en cas de rejeu (`ALG-02`, tests T06/T12).
2. **Aucun secret en clair dans le repo.** Utiliser variables d'env / Vault-like local pour le PoC.
3. **Token jamais loggé en clair** (masquage obligatoire dans logs et dashboard — test C05).
4. **Ne jamais coder un protocole compteur réel en dur** dans le service métier — toujours passer
   par l'interface `meter_adapter`.
5. **Chaque commande doit être traçable de bout en bout** : `transactionId → commandId → ACK →
   audit_log`, avec `correlation_id` propagé partout.
6. **mTLS + ACL** sur MQTT : un dongle ne peut lire/écrire que ses propres topics.

## Modèle de données minimal (PoC)

Tables : `payment`, `command`, `audit_event`, `device`, `meter`
(voir `docs/02_developer-pack.md` §11_DB et §28 pour le détail des champs).

## Stack technique

- Backend : Java 21, Spring Boot, Maven/Gradle, Spring Security
- Messagerie : MQTT (Mosquitto/EMQX) sur TLS, QoS 1 pour les commandes
- DB : PostgreSQL
- Simulateurs (hors backend Java, mais dans le repo) : Python 3.12 + FastAPI (Payment Simulator, Mock Meter)
- Observabilité : logs JSON structurés corrélés par `transactionId`/`commandId` ; métriques
  `payments_total`, `commands_total`, `activations_success_total`, `activation_latency_ms`
- Infra locale : Docker Compose (DB + broker MQTT + backend)
- Tests : JUnit (unit + intégration Spring Boot), pytest pour les simulateurs/orchestration

## Critères d'acceptation (Gate 1 : "Mock end-to-end fonctionnel")

- T01 Paiement nominal → `SUCCESS`
- T02 Génération/association token → token lié à la transaction
- T03 Transmission MQTT → ACK reçu
- T04 Activation token valide → `ACCEPTED` (via MockMeter)
- T05 Token invalide → `REJECTED`, aucune activation
- T06 Double commande (même `commandId`) → une seule exécution
- T15 Auditabilité → trace complète bout en bout en DB

(Liste complète des tests T01–T15 et tests cyber C01–C07 dans `docs/02_developer-pack.md`.)

## Structure du repo (monorepo)

```
/backend
  /payment-service
  /token-command-service
  /device-service
  /audit-service
  /mqtt-gateway
  /meter-adapter        # interface + impl MockMeter (+ futur adapter réel)
  /common               # DTOs partagés, events, config commune
/simulators
  /payment-simulator     # Python/FastAPI
  /mock-meter             # Python/FastAPI, implémente meter_adapter en HTTP
/infra
  docker-compose.yml
  /db-migrations
  /mqtt-config
/tests
  /integration
  /security
/docs                    # docs sources fournies (architecture V2, algorithmes, etc.)
CLAUDE.md
```

## État d'avancement (24/08/2026)

Le backend PoC est **entièrement codé** en un seul déployable Spring Boot (packages
`payment`, `recharge`, `device`, `audit`, `meteradapter`, `mqtt`, `common`) + deux
simulateurs Python (`payment-simulator`, `mock-dongle`), + `docker-compose.yml` complet.

**Testé et validé dans le sandbox de conception** (pytest, 7/7 tests passent) :
simulateurs Python (logique métier T01, T04, T05, T06, T12).

**Non testé** (pas d'accès Maven Central dans le sandbox de conception) : compilation et
tests du backend Java, intégration Docker Compose complète. **Prochaine étape immédiate
pour Claude Code** :

1. `docker compose up --build` à la racine, corriger les éventuelles erreurs de
   compilation Maven ou de wiring Spring (le code n'a jamais été compilé).
2. Dérouler le scénario T01→T06→T15 du README.md et corriger les écarts.
3. `mvn test` dans `backend/poc-backend` pour valider `RechargeOrchestratorIdempotencyTest`.
4. Ajouter un endpoint de recette pour forcer T05 (token invalide) sans flag caché.
5. Une fois Gate 1 validé, durcir la sécurité MQTT (TLS + ACL par device) avant tout essai
   avec un compteur réel de laboratoire CIE.

Voir README.md à la racine pour le tableau détaillé "fait / reste à faire".
