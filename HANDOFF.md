# Contexte de reprise — CIE Smart Retrofit Metering

À coller dans une nouvelle session Claude Code, ouverte dans ce même dossier
(`C:\Users\yaoko\Downloads\Projet_Smartex_CIE\smartex_cie`).

## Projet

PoC de retrofit pour compteurs prépayés CIE (Côte d'Ivoire) : paiement → token →
commande MQTT → compteur (simulé) → audit. Voir `CLAUDE.md` à la racine pour le
contexte complet (règles non-négociables, stack, structure du repo). Backend Java
21/Spring Boot (`backend/poc-backend`), simulateurs Python (`simulators/`),
frontend React/Vite (`frontend/`), orchestré par `docker-compose.yml`.

## Branche actuelle : `feature/telemetry-alg01`

Créée depuis `feature/connect-frontend-backend` (après y avoir fusionné
`test/t14-performance`). **Pas encore mergée sur `main`.** 11 commits, tous
poussés en local uniquement (pas de remote push effectué).

## Ce qui a été fait dans la session précédente (chronologique)

1. **`fix(mqtt)` + `feat(mock-dongle)` (T08/résilience, avant la partie ALG-01)**
   — délai initial du `CommandExpiryWatcher` pour réduire une course avec la
   redélivrance MQTT ; persistance JSON du crédit/anti-rejeu du mock-dongle à
   travers un `docker compose restart`.

2. **`feat(telemetry)` — ALG-01 simplifié** : nouveau domaine backend
   `ci.cie.smartprepaid.telemetry` (`MeterReading`, `TelemetryCollector` job
   planifié, `CreditAutonomyService`, `NetConsumptionCalculator` — reconstruit la
   consommation nette entre deux relevés en excluant les recharges appliquées
   dans l'intervalle). Migration `V5`. Expose `autonomyDays`/`creditStatus`
   (`NORMAL/WARNING/CRITICAL/IMMEDIATE`)/`dataQuality` (`REAL/FALLBACK`) sur
   `GET /api/v1/meters/{id}/status`. **Pas de `creditPercent`** : point ouvert
   documenté dans `docs/05_reconciliation-api-frontend-backend.md` §3 (3 options
   à trancher côté produit — pas de plafond naturel en système prépayé).

3. **`feat(mock-dongle)` — simulation de consommation** : le crédit simulé ne
   faisait qu'augmenter avant ; boucle d'arrière-plan qui décrémente
   `credit_fcfa` (`CONSUMPTION_RATE_FCFA_PER_HOUR`, défaut 150 FCFA/h).

4. **`feat(api)` — endpoints backend ajoutés pour connecter le frontend** :
   `GET /api/v1/customers` (liste, admin), `GET /api/v1/devices` (liste,
   support), `GET /api/v1/meters` (liste flotte), `GET /api/v1/recharges[?customerId=]`
   (historique, ownership ou fleet complète), `GET /api/v1/meters/{id}/consumption`
   (historique bucketé). 19 tests HTTP d'autorisation dédiés
   (`AuthorizationHttpTest`). **52/52 tests backend passent** (`mvn test` dans
   `backend/poc-backend`).

5. **`feat(frontend)` — connexion de `RealApiAdapter`** : quasi tous les
   endpoints branchés sur le vrai backend (compteur, historique conso,
   transactions, utilisateurs, devices, alertes dérivées d'ALG-01). Restent mock
   avec justification explicite dans le code (`realApi.ts`) : tokens (jamais
   exposés en clair), incidents et catalogue de services (hors scope PoC,
   inventeraient un `incident-service`/registre de microservices qui n'existent
   pas). Voir `docs/05` §9 pour le détail endpoint par endpoint.

6. **`fix(frontend)` — bug rapporté par l'utilisateur : une recharge semblait
   réussir puis "revenait à zéro" au rechargement de page.** Cause réelle :
   l'écran de recharge (`recharge.tsx`) était 100% simulé côté client, jamais
   d'appel au vrai backend. Corrigé : `api.createRecharge()` appelle réellement
   `POST /api/v1/recharges` (au moment où le paiement simulé est confirmé, pas
   avant), `RechargeStatus` interroge le vrai statut par polling au lieu d'une
   animation programmée. Bug de double-comptage révélé et corrigé au passage
   (`lastPaymentAmount` ne s'ajoute plus qu'en mode mock).

7. **`feat(frontend)` — rafraîchissement automatique du compteur** : nouveau
   hook `useLiveMeter` (polling `GET /meters/{id}/status` toutes les 5s), branché
   sur le dashboard et l'écran "Mon compteur", avec un petit indicateur "en
   direct" (point qui pulse) — demandé par l'utilisateur pour voir le crédit
   diminuer sans recharger la page.

8. **`feat` — accessible depuis d'autres appareils du réseau local** :
   `vite.config.ts` écoute sur toutes les interfaces (`server.host: true`) ;
   CORS backend (`CorsConfig.java`, profil `dev` uniquement) étendu aux plages
   d'adresses privées RFC1918 en plus de `localhost:5173`. `frontend/.env`
   (non versionné) pointe `VITE_API_BASE_URL` vers l'IP LAN de la machine hôte
   (`192.168.1.6` au moment de la session — **peut avoir changé**, vérifier
   avec `ipconfig` si besoin et mettre à jour `.env` + relancer `npm run dev`).
   L'utilisateur devait lancer lui-même (réglage système, jamais fait par
   Claude) :
   ```powershell
   New-NetFirewallRule -DisplayName "CIE PoC - Vite dev (5173)" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Private
   New-NetFirewallRule -DisplayName "CIE PoC - Backend (8080)" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
   ```
   **Statut non confirmé** : l'utilisateur n'avait pas encore confirmé avoir
   lancé cette commande ni redémarré son serveur frontend à la fin de la
   session précédente.

9. **`feat(frontend)` — notifications enregistrées comme alertes** :
   `store.notify()` enregistre désormais systématiquement une entrée dans
   `alerts` (visible sur `/app/alertes`), plus le toast éphémère habituel.
   Nouveau `removeAlert(alertId)` + bouton 🗑 par carte. Validé dans le
   navigateur (sans rechargement de page) : le store `alerts` est en mémoire
   uniquement, ne survit pas à un vrai F5 (seule la session JWT persiste via
   `sessionStorage`) — signalé à l'utilisateur, pas encore tranché s'il faut
   aussi persister ça.

## État de l'environnement au moment de la reprise

- **Backend** : tournait via `docker compose up -d` (5 conteneurs : postgres,
  mosquitto, backend, mock-dongle, payment-simulator). Reconstruit
  (`--build`) après chaque changement de code Java. Vérifier avec
  `docker compose ps` si toujours actif.
- **Frontend** : un `npm run dev` tournait déjà sur le port 5173, lancé par
  l'utilisateur en dehors de cette session (pas un processus géré par Claude).
  Après le point 8 ci-dessus, il doit être redémarré pour appliquer
  `vite.config.ts`/`.env` — pas confirmé que ce soit fait.
- **`.claude/launch.json`** créé (non commité, `frontend-dev` via
  `npm --prefix frontend run dev`) pour prévisualiser depuis Claude si besoin,
  mais le port 5173 était déjà occupé par le serveur de l'utilisateur.
- **Comptes de test** (base de labo, profil `dev`) :
  - `0700000001` ("Test Client", CLIENT) — utilisé pour tous les tests de cette
    session. OTP visible dans les logs backend :
    `docker compose logs backend --tail 5 | grep OTP-MOCK`.
  - `0700000099` ("Support CIE Lab", CIE_OPERATOR par défaut) — seedé par
    `V4__seed_lab_operator.sql`. A été temporairement élevé en `CIE_ADMIN` via
    SQL direct pendant les tests puis **remis à `CIE_OPERATOR`** (état propre).
  - Aucun compte `CIE_ADMIN`/`DSI_ADMIN` de labo n'est seedé par défaut — les
    écrans admin CIE (`cie.tsx`, `admin.tsx`) n'ont pas été testés au clic par
    clic dans le navigateur (seulement via curl direct + vérification de
    typage), faute d'un tel compte pré-provisionné.

## Points ouverts / à trancher

1. **`creditPercent`** (docs/05 §3) — pas de plafond naturel en système
   prépayé, 3 options à discuter avec le collègue frontend.
2. **Persistance des alertes** à travers un vrai rechargement de page (F5) —
   pas encore demandé explicitement, mentionné comme extension possible.
3. **Écrans admin CIE** (`cie.tsx`, `admin.tsx`) — endpoints réels vérifiés
   côté backend, mais jamais cliqués dans le navigateur faute de compte admin
   de labo.
4. **IP LAN** dans `frontend/.env` — à revérifier si le réseau a changé.
5. Le pare-feu Windows (ports 5173/8080) — statut non confirmé par
   l'utilisateur à la fin de la session précédente.

## Comment vérifier que tout fonctionne

```bash
cd backend/poc-backend && mvn test          # 52/52 attendus
cd simulators/mock-dongle && python -m pytest -v   # 11/11 attendus
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run build && npm run lint
```
