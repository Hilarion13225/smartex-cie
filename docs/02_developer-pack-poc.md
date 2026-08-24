## 00_README
| CIE Smart Meter Retrofit — Laboratory PoC Developer & Validation Pack | Unnamed: 1 |
| --- | --- |
| NaN | NaN |
| Rubrique | Contenu |
| Objet | Préparer avec un développeur SMARTEX Expertises un PoC de laboratoire démontrable et testable avant l'accès au laboratoire CIE. |
| Périmètre | Paiement simulé → token → orchestration → MQTT/TLS → Dongle → adaptateur compteur → acceptation → audit/monitoring. |
| Principe | Ne pas figer le protocole compteur avant qualification du modèle exact et de l'interface autorisée par la CIE. |
| Sécurité | PoC isolé, credentials de labo, aucune donnée réelle non nécessaire, aucun raccordement secteur réalisé par le développeur. |
| Stack de référence | STM32/FreeRTOS/C-C++; Spring Boot/Java; Python/FastAPI pour simulateurs; MQTT/TLS; PostgreSQL; Grafana; GitLab CI/CD. |
| Pré-requis CIE | Modèle(s) compteur, interface/protocole, procédure de token, contraintes électriques, règles de cybersécurité, moyens d'essai et critères d'acceptation. |
| Livrables | Repo Git, firmware, backend, simulateurs, scripts de test, DB, dashboard, dossier de recette, rapport et décision GO/NO-GO. |
| Avertissement | Les interfaces et paramètres exacts doivent être validés par CIE. Les extraits de code sont des bases de PoC, pas une implémentation certifiée du compteur. |

## 01_Objectifs
| Élément | Détail |
| --- | --- |
| Objectif principal | Prouver l'opérationnalisation de l'activation automatique après paiement, sans remplacement du compteur. |
| Question de preuve | Le système peut-il identifier le bon compteur, transmettre une commande sécurisée, obtenir une réponse et produire une trace d'audit ? |
| Hors périmètre | Industrialisation, homologation définitive, raccordement production, intégration PSP réelle, certification réglementaire. |
| Gate 0 | Compteur et protocole qualifiés. |
| Gate 1 | Mock end-to-end fonctionnel. |
| Gate 2 | Banc réel CIE fonctionnel. |
| Gate 3 | Sécurité + résilience + audit acceptés. |
| Gate 4 | PV laboratoire signé → décision pilote. |

## 02_PreLab
| Élément | Détail |
| --- | --- |
| J-20 à J-15 | Obtenir modèle compteur, documentation/interface, token flow, contraintes laboratoire. |
| J-14 | Atelier 2h avec développeur SMARTEX + référent CIE. |
| J-13 à J-10 | Construire Mock Meter + Payment Simulator. |
| J-10 à J-7 | Backend/MQTT/DB + tests unitaires. |
| J-7 à J-5 | Firmware + sécurité + idempotence. |
| J-5 à J-3 | Intégration sur matériel de développement. |
| J-2 | Dry run complet + correction P1/P2. |
| J-1 | Geler version Git, checksum firmware, backup, dossier de recette. |
| Jour J | Installation contrôlée, tests T01–T15, journal de preuves. |

## 03_Architecture
| Élément | Détail |
| --- | --- |
| Couche 1 | Payment Simulator / Mobile Money adapter. |
| Couche 2 | API + orchestration + token/command service. |
| Couche 3 | MQTT broker TLS + PKI. |
| Couche 4 | Dongle STM32 + secure element + modem. |
| Couche 5 | Meter Adapter — protocole réel à qualifier. |
| Couche 6 | Compteur prépayé CIE de laboratoire. |
| Couche 7 | Observabilité: logs, métriques, audit, dashboard. |
| Couche 8 | CI/CD: GitLab, tests automatisés, artefacts versionnés. |

## 04_BOM
| ID | Équipement | Qté | Responsable | Spécification/choix | Usage/contrainte |
| --- | --- | --- | --- | --- | --- |
| B01 | Compteur prépayé CIE de laboratoire | 1–2 | CIE | Modèle exact à qualifier | Équipement sous contrôle CIE |
| B02 | Dongle prototype | 2–5 | SMARTEX | STM32 + modem + secure element | Prototype V0 |
| B03 | Carte STM32 Nucleo/équivalent | 2–3 | SMARTEX | Développement firmware | Banc |
| B04 | Modem cellulaire de développement | 2–3 | SMARTEX | 4G/LTE-M/NB-IoT selon choix | Banc |
| B05 | Secure Element | 2–5 | SMARTEX | ATECC/équivalent à valider | Identité cryptographique |
| B06 | Routeur labo | 1 | SMARTEX/CIE | Réseau isolé | Pas de production |
| B07 | Mini-PC/serveur labo | 1 | SMARTEX | Docker/VM | Backend + DB + broker |
| B08 | Alimentation DC protégée | 2 | CIE/SMARTEX | Banc basse tension | Sécurité |
| B09 | Charge de démonstration basse tension | 1 | SMARTEX | LED/charge adaptée au banc | Démonstration |
| B10 | Oscilloscope/multimètre | Selon labo | CIE | Instrumentation | Uniquement personnel habilité |
| B11 | Câbles/convertisseurs interface | Selon compteur | SMARTEX/CIE | Après protocole qualifié | À documenter |
| B12 | Laptop développeur | 1–2 | SMARTEX | IDE + Docker + Git | Préparation |

## 05_DevEnv
| Élément | Détail |
| --- | --- |
| IDE/firmware | STM32CubeIDE ou toolchain GCC/Clang validée; STM32CubeMX si utilisé. |
| Firmware | C/C++, FreeRTOS, HAL/LL selon carte. |
| Backend | Java 21 + Spring Boot; Maven/Gradle. |
| Simulateurs | Python 3.12 + FastAPI + pytest. |
| Broker | Mosquitto/EMQX de labo avec TLS. |
| DB | PostgreSQL. |
| Observabilité | Prometheus + Grafana + Loki/ELK selon environnement. |
| Containers | Docker Compose pour le dry-run. |
| SCM | GitLab avec merge requests, tags, protected branches. |
| Secrets | Vault/PKI ou mécanisme CIE approuvé; jamais de secrets en clair dans Git. |

## 06_Repo
| Élément | Détail |
| --- | --- |
| Repo | cie-smart-meter-retrofit-poc |
| 01-firmware | Firmware Dongle, HAL, MQTT, sécurité, meter\_adapter. |
| 02-backend | Spring Boot: payment, token, command, device, audit. |
| 03-simulators | Payment Simulator, Mock Meter, MQTT test broker. |
| 04-tests | pytest, tests intégration, tests sécurité. |
| 05-infra | docker-compose, DB migrations, broker TLS, observabilité. |
| 06-docs | Architecture, ADR, test plan, runbook, PV. |
| 07-tools | Scripts de génération de certificats de labo, lint, diagnostics. |
| Branches | main protégée; develop; feature/\*; release/\*. |
| Tag labo | LAB-POC-v0.1.0 puis LAB-POC-v0.2.0 après corrections. |

## 07_Firmware
| Élément | Détail |
| --- | --- |
| Responsabilité | Recevoir une commande authentifiée, vérifier anti-rejeu/idempotence, appeler l'adaptateur compteur, publier résultat. |
| Tâches RTOS | mqtt\_task, command\_task, meter\_task, telemetry\_task, watchdog\_task. |
| Stockage local | File persistante minimale pour commandes en attente; taille limitée et stratégie de reprise documentée. |
| Watchdog | Redémarrage contrôlé si tâche bloquée; journaliser cause du reset. |
| Sécurité | TLS mutuel, certificat unique, secure element si disponible. |
| Mode simulation | Une implémentation MockMeter doit permettre le développement sans compteur réel. |
| Code de départ | Voir feuille 26\_Code\_Firmware. |

## 08_Backend
| Élément | Détail |
| --- | --- |
| Payment Service | Reçoit paiement simulé et crée transaction unique. |
| Token/Command Service | Associe token, compteur et dongle; crée commandId unique. |
| Device Service | Gère identité, statut, dernière télémétrie. |
| Audit Service | Écrit les événements immuables/logiquement append-only. |
| MQTT Gateway | Publie QoS 1 et corrèle commandId/ACK. |
| Idempotence | transactionId et commandId uniques; aucune exécution double. |
| Code de départ | Voir feuilles 27\_Code\_Backend et 28\_Code\_DB. |

## 09_PaymentSimulator
| Élément | Détail |
| --- | --- |
| But | Simuler le PSP/Mobile Money pour isoler la preuve technique. |
| Entrée | meterId, amountXof, currency. |
| Sortie | transactionId, SUCCESS, timestamp. |
| Règle | Aucune vraie transaction financière. |
| Test | T01 puis T02. |
| Code | Voir 29\_Code\_Simulateurs. |

## 10_MQTT
| Élément | Détail |
| --- | --- |
| Topics | cie/lab/{dongleId}/command/token; /ack; /event; /telemetry. |
| QoS | QoS 1 pour commandes; stratégie de déduplication obligatoire. |
| TLS | TLS 1.2+ selon politique CIE; certificats de labo. |
| Retained messages | Désactivés pour les commandes d'activation. |
| ACL | Un dongle ne lit que ses topics autorisés. |
| Last Will | État offline documenté. |
| Test | T03, T06, T07, T11, T12. |

## 11_DB
| Élément | Détail |
| --- | --- |
| Tables | payment, command, audit\_event, device, meter. |
| Clés | transaction\_id unique; command\_id unique; relation meter↔dongle. |
| Audit | timestamp, actor/source, commandId, result, errorCode. |
| Rétention | Définir durée de conservation pour le PoC avec CIE. |
| Masquage | Ne pas exposer le token complet dans les logs/dashboard. |
| Code | Voir 28\_Code\_DB. |

## 12_Securite
| Élément | Détail |
| --- | --- |
| Identité | Chaque Dongle possède un identifiant unique et un certificat. |
| Transport | MQTT sur TLS. |
| Authentification | mTLS + ACL. |
| Autorisation | Le backend ne peut commander que le dongle associé au compteur. |
| Anti-rejeu | nonce + commandId + fenêtre temporelle. |
| Secrets | Vault/secure element ou mécanisme CIE approuvé. |
| Firmware | Version signée; pas d'OTA en premier test si cela ajoute du risque. |
| Tests | T11 commande non autorisée; T12 rejeu; T13 expiration. |

## 13_MeterAdapter
| Élément | Détail |
| --- | --- |
| Principe | Ne jamais coder le protocole réel directement dans le service métier. |
| Interface | meter\_adapter\_enter\_token(), read\_status(), read\_credit(), healthcheck(). |
| Implémentation 1 | MockMeter HTTP pour dry-run. |
| Implémentation 2 | Adapter protocole réel après qualification CIE. |
| Validation | Documenter chaque commande, réponse, timeout, checksum/CRC si applicable. |
| Sécurité | Aucune opération dangereuse; accès électrique contrôlé par personnel CIE habilité. |

## 14_TestMatrix
| ID | Test | Composants | Entrée | Résultat attendu | Mode | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | Paiement nominal | Simulateur paiement | 5 000 XOF | Payment SUCCESS | Automatique | Oui |
| T02 | Génération/association token | Backend + token service | Meter CIE-LAB-0001 | Token associé à transaction | Automatique | Oui |
| T03 | Transmission MQTT | Backend + broker + dongle | Commande valide | ACK reçu | Automatique | Oui |
| T04 | Activation token valide | Dongle + mock/compteur labo | Token valide | Compteur ACCEPTED | Automatique + observation | Oui |
| T05 | Token invalide | Dongle + compteur labo | Token volontairement invalide | REJECTED, aucune activation | Automatique | Oui |
| T06 | Double commande | Backend + dongle | Même commandId 2x | 1 seule exécution | Automatique | Oui |
| T07 | Perte réseau | Broker/réseau labo | Interruption 10–30 s | Reprise sans perte | Automatique | Oui |
| T08 | Redémarrage dongle | Dongle | Power cycle contrôlé | Reconnexion + état cohérent | Manuel + logs | Oui |
| T09 | Coupure alimentation banc | Banc labo sécurisé | Power cycle contrôlé | Reprise sans corruption | Manuel + logs | Oui |
| T10 | Mauvaise association | Backend | Dongle A / compteur B | Commande rejetée | Automatique | Oui |
| T11 | Commande non autorisée | Sécurité | Certificat/identité invalide | Rejet | Automatique | Oui |
| T12 | Rejeu | Sécurité | Même commande signée | Rejet/DUPLICATE | Automatique | Oui |
| T13 | Expiration | Backend + dongle | Commande hors fenêtre | Rejet | Automatique | Oui |
| T14 | Latence E2E | Tous composants | Paiement → activation | Mesure p50/p95 | Automatique | Oui |
| T15 | Auditabilité | Backend + DB | Transaction complète | Trace complète de bout en bout | Automatique | Oui |

## 15_TestAutomation
| Élément | Détail |
| --- | --- |
| Framework | pytest pour orchestration des tests; JUnit pour Spring Boot. |
| Test pyramid | Unitaires → intégration → HIL/labo → recette. |
| Preconditions | Services UP, DB clean, broker clean, certificats labo valides. |
| Evidence | Chaque test produit timestamp, transactionId, commandId, résultat, logs et capture dashboard. |
| Nommage | T01\_..., T02\_..., etc. |
| Fail fast | Stopper si sécurité, association compteur/dongle ou intégrité des commandes échoue. |
| Code | Voir 30\_Code\_Tests. |

## 16_FailureInjection
| Élément | Détail |
| --- | --- |
| Réseau OFF | Broker inaccessible 10–30 s. |
| Dongle reboot | Redémarrage contrôlé. |
| Backend restart | Redémarrer service sans perdre l'état DB. |
| Duplicate | Réémettre même commandId. |
| Invalid token | Utiliser token réservé au laboratoire. |
| Wrong dongle | Envoyer vers identité non autorisée. |
| Expired | Timestamp hors fenêtre. |
| Evidence | Capturer logs + état DB + dashboard. |

## 17_Observability
| Élément | Détail |
| --- | --- |
| Metrics | payments\_total, commands\_total, activations\_success\_total, activation\_latency\_ms, mqtt\_reconnects\_total. |
| Logs | JSON structuré, corrélation transactionId/commandId. |
| Dashboard | Vue système + vue compteur + erreurs. |
| Alertes | Dongle offline, taux d'échec > seuil, latence p95 > seuil convenu. |
| SQL | Voir 32\_SQL\_Observability. |

## 18_CyberTests
| Élément | Détail |
| --- | --- |
| C01 | Certificat invalide → rejet. |
| C02 | Dongle A tente commande compteur B → rejet. |
| C03 | Rejeu même commandId → rejet/dedup. |
| C04 | Commande expirée → rejet. |
| C05 | Token dans logs → doit être masqué. |
| C06 | Broker ACL → topics non autorisés inaccessibles. |
| C07 | Secrets Git → scan sans secret. |

## 19_LabProcedure
| Élément | Détail |
| --- | --- |
| 1 | Brief sécurité et responsabilités. |
| 2 | Vérifier version Git/tag + checksums. |
| 3 | Vérifier réseau de labo et isolation. |
| 4 | Vérifier alimentation et instrumentation. |
| 5 | Démarrer DB/broker/backend/dashboard. |
| 6 | Démarrer dongle et vérifier ONLINE. |
| 7 | Exécuter T01–T05. |
| 8 | Exécuter T06–T10. |
| 9 | Exécuter T11–T15. |
| 10 | Capturer preuves. |
| 11 | Analyser anomalies. |
| 12 | Signer PV de recette / décision. |

## 20_Acceptance
| Élément | Détail |
| --- | --- |
| Fonctionnel | 100% T01–T05 passés. |
| Idempotence | 100% T06 sans double exécution. |
| Résilience | T07–T09 passés selon critères convenus. |
| Sécurité | T11–T13 passés sans contournement. |
| Performance | p50/p95 mesurés et seuils approuvés. |
| Audit | T15 traçable de bout en bout. |
| GO | Aucune anomalie critique; toutes les exigences Must passées. |
| NO-GO | Anomalie critique sécurité/intégrité ou activation non maîtrisée. |

## 21_RACI
| Activité | CIE référent | SMARTEX | Digitalisation | Cybersécurité / autre |
| --- | --- | --- | --- | --- |
| Qualification compteur | CIE Production | SMARTEX | Digitalisation | Cybersécurité |
| Firmware | SMARTEX | CIE | Digitalisation | Cybersécurité |
| Backend | SMARTEX | CIE DSI | Digitalisation | Cybersécurité |
| Sécurité/PKI | CIE Cybersécurité | SMARTEX | DSI | Production |
| Banc physique | CIE | SMARTEX | Production | HSE/électricité |
| Tests | SMARTEX | CIE | Digitalisation | Cybersécurité |
| Recette | CIE | SMARTEX | Direction Production/Digitalisation | DSI |
| GO/NO-GO | Direction CIE | SMARTEX (reco) | Digitalisation | Production/Cyber |

## 22_Timeline
| Période | Activité | Responsable | Livrable | Critère |
| --- | --- | --- | --- | --- |
| S1 | Kick-off + qualification compteur | CIE + SMARTEX | Modèle, protocole, interface, contraintes | Architecture validée |
| S2 | Architecture + repo + CI | SMARTEX | GitLab, conventions, tickets | Pipeline vert |
| S3 | Mock Meter + Payment Simulator | SMARTEX | API + tests | Tests T01/T02 |
| S4 | Backend + DB + MQTT | SMARTEX | Services + broker | T03/T06 |
| S5 | Firmware + secure identity | SMARTEX | STM32/RTOS + MQTT TLS | T03/T08 |
| S6 | Adapter compteur | SMARTEX + CIE | Interface réelle de labo | T04/T05 |
| S7 | Observabilité + sécurité | SMARTEX + CIE | Logs, audit, dashboards | T11–T15 |
| S8 | Dry run complet | SMARTEX | Répétition sans CIE production | 100% scénario |
| S9 | Pré-recette interne | SMARTEX + référents CIE | Rapport + anomalies | Go labo |
| S10 | Recette laboratoire CIE | CIE + SMARTEX | LAT/UAT | PV de recette |
| S11–12 | Corrections + dossier décision | CIE + SMARTEX | Rapport final | GO/NO-GO pilote |

## 23_Risks
| ID | Risque | Probabilité | Impact | Mitigation | Moment |
| --- | --- | --- | --- | --- | --- |
| R01 | Protocole compteur inconnu | Élevé | Très élevé | Atelier de qualification + adaptateur | Avant code final |
| R02 | Connexion directe au compteur non conforme | Élevé | Très élevé | Validation CIE + interface approuvée | Gate sécurité |
| R03 | Double exécution token | Moyen | Élevé | Idempotency + audit + tests rejeu | T06/T12 |
| R04 | Perte réseau | Moyen | Élevé | Queue persistante + retry borné | T07 |
| R05 | Clés/certificats mal gérés | Élevé | Très élevé | Secure Element + PKI + secrets management | T11/T12 |
| R06 | Confusion PoC/production | Moyen | Élevé | Réseau, credentials et données isolés | Tous |
| R07 | Performance insuffisante | Moyen | Moyen | Mesure p95 + tests de charge labo | T14 |
| R08 | Firmware instable | Moyen | Élevé | Watchdog, logs, CI, HIL | T08/T09 |
| R09 | Données sensibles exposées | Moyen | Élevé | Masquage token + chiffrement logs | T15 |
| R10 | Validation métier non alignée | Moyen | Élevé | Critères GO/NO-GO signés avant recette | Avant T01 |

## 24_DemoScript
| Élément | Détail |
| --- | --- |
| 00:00 | Présenter compteur CIE-LAB-0001 à crédit 0. |
| 00:30 | Lancer paiement simulé 5 000 XOF. |
| 01:00 | Montrer transaction SUCCESS + commandId. |
| 01:30 | Montrer Dongle ONLINE et message MQTT. |
| 02:00 | Montrer compteur ACCEPTED / crédit disponible. |
| 02:30 | Montrer dashboard audit complet. |
| 03:00 | Déclencher un rejeu: démontrer DUPLICATE/REJECTED. |
| 03:30 | Couper réseau: paiement PENDING. |
| 04:00 | Rétablir réseau: reprise automatique. |
| 04:30 | Conclusion: aucun accès physique nécessaire dans le scénario cible. |

## 25_CodeIndex
| Élément | Détail |
| --- | --- |
| 26\_Code\_Firmware | Squelette STM32/FreeRTOS + topics MQTT + adaptateur compteur. |
| 27\_Code\_Backend | Spring Boot Payment/Command/Idempotence. |
| 28\_Code\_DB | Schéma PostgreSQL + requêtes observabilité. |
| 29\_Code\_Simulateurs | FastAPI Payment Simulator + Mock Meter + MQTT publisher. |
| 30\_Code\_Tests | pytest: nominal, idempotence, panne réseau, rejeu. |
| 31\_Code\_CI | GitLab CI/CD minimal. |

## 26_Code_Firmware
| STM32/FreeRTOS — squelette principal |
| --- |
| // Cible: STM32 + FreeRTOS.\n// IMPORTANT: interface compteur à adapter après identification du modèle/protocole CIE.\n// Le code ci-dessous est un squelette de PoC: pas de pilotage secteur/mains.\n\ntypedef struct {\n    char command\_id[40];\n    char meter\_id[40];\n    char token[128];\n    long amount\_xof;\n    char transaction\_id[64];\n    char signature\_b64[512];\n} TokenCommand;\n\nstatic QueueHandle\_t cmd\_queue;\n\nvoid app\_init(void) {\n    cmd\_queue = xQueueCreate(8, sizeof(TokenCommand));\n    meter\_adapter\_init();      // HAL/protocole à qualifier avec CIE\n    secure\_element\_init();     // identité/certificat\n    mqtt\_init\_tls();\n}\n\nvoid mqtt\_on\_message(const char \*topic, const uint8\_t \*payload, size\_t len) {\n    TokenCommand cmd;\n    if (!json\_decode\_token\_command(payload, len, &cmd)) {\n        audit\_event("INVALID\_JSON");\n        return;\n    }\n\n    if (!security\_verify\_command(&cmd)) {\n        audit\_event("AUTH\_OR\_SIGNATURE\_FAILED");\n        return;\n    }\n\n    if (!idempotency\_accept(cmd.command\_id)) {\n        audit\_event("DUPLICATE\_COMMAND");\n        return;\n    }\n\n    xQueueSend(cmd\_queue, &cmd, pdMS\_TO\_TICKS(100));\n}\n\nvoid meter\_task(void \*arg) {\n    TokenCommand cmd;\n    for (;;) {\n        if (xQueueReceive(cmd\_queue, &cmd, portMAX\_DELAY) == pdTRUE) {\n            MeterResult r = meter\_adapter\_enter\_token(cmd.token);\n\n            publish\_result(cmd.command\_id,\n                           r.accepted ? "ACCEPTED" : "REJECTED",\n                           r.error\_code);\n\n            audit\_event(r.accepted ? "TOKEN\_ACCEPTED" : "TOKEN\_REJECTED");\n        }\n    }\n} |
| NaN |
| Topics MQTT |
| // Convention MQTT de PoC\n// cie/lab/{dongleId}/command/token\n// cie/lab/{dongleId}/event\n// cie/lab/{dongleId}/telemetry\n// cie/lab/{dongleId}/ack\n\n// Exemple payload command/token:\n{\n  "commandId": "CMD-2026-000001",\n  "meterId": "CIE-LAB-0001",\n  "transactionId": "TX-2026-000001",\n  "token": "REDACTED",\n  "amountXof": 5000,\n  "issuedAt": "2026-08-23T15:00:00Z",\n  "expiresAt": "2026-08-23T15:05:00Z",\n  "nonce": "random-unique-value",\n  "signature": "BASE64\_SIGNATURE"\n} |
| NaN |
| Interface Meter Adapter |
| // Ne pas figer DLMS/COSEM ou un protocole propriétaire avant qualification du compteur.\n// L'adaptateur isole le backend/firmware du protocole réel.\n\ntypedef enum {\n    METER\_OK = 0,\n    METER\_INVALID\_TOKEN,\n    METER\_TIMEOUT,\n    METER\_COMM\_ERROR,\n    METER\_BUSY,\n    METER\_UNKNOWN\_ERROR\n} MeterError;\n\ntypedef struct {\n    bool accepted;\n    MeterError error\_code;\n    uint32\_t latency\_ms;\n} MeterResult;\n\nvoid meter\_adapter\_init(void);\nMeterResult meter\_adapter\_enter\_token(const char \*token);\nbool meter\_adapter\_read\_status(char \*status, size\_t status\_len);\nbool meter\_adapter\_read\_credit(int64\_t \*credit\_xof);\nbool meter\_adapter\_healthcheck(void); |

## 27_Code_Backend
| Spring Boot — Payment Controller |
| --- |
| @RestController\n@RequestMapping("/api/v1/payments")\npublic class PaymentController {\n    private final PaymentService paymentService;\n\n    public PaymentController(PaymentService paymentService) {\n        this.paymentService = paymentService;\n    }\n\n    @PostMapping\n    public ResponseEntity<PaymentResponse> create(@Valid @RequestBody PaymentRequest req) {\n        return ResponseEntity.ok(paymentService.process(req));\n    }\n}\n\npublic record PaymentRequest(\n    @NotBlank String transactionId,\n    @NotBlank String meterId,\n    @Positive long amountXof,\n    @NotBlank String currency\n) {}\n\npublic record PaymentResponse(\n    String transactionId,\n    String status,\n    String commandId\n) {} |
| NaN |
| Idempotence |
| @Service\npublic class IdempotencyService {\n    private final CommandRepository repository;\n\n    public IdempotencyService(CommandRepository repository) {\n        this.repository = repository;\n    }\n\n    @Transactional\n    public Command createIfAbsent(String commandId, String meterId, String transactionId) {\n        return repository.findByCommandId(commandId)\n            .orElseGet(() -> repository.save(\n                Command.pending(commandId, meterId, transactionId)\n            ));\n    }\n}\n\n// Règle: une commande commandId donnée ne peut être exécutée qu'une seule fois.\n// Le compteur reste l'autorité finale d'acceptation du token. |
| NaN |
| Command Service |
| @Service\npublic class CommandService {\n    private final MqttGateway mqtt;\n    private final IdempotencyService idempotency;\n\n    public CommandService(MqttGateway mqtt, IdempotencyService idempotency) {\n        this.mqtt = mqtt;\n        this.idempotency = idempotency;\n    }\n\n    public String dispatch(TokenCommandRequest req) {\n        String commandId = "CMD-" + UUID.randomUUID();\n        idempotency.createIfAbsent(commandId, req.meterId(), req.transactionId());\n\n        TokenCommandMessage msg = new TokenCommandMessage(\n            commandId, req.meterId(), req.transactionId(),\n            req.token(), req.amountXof(), Instant.now()\n        );\n\n        mqtt.publish("cie/lab/" + req.dongleId() + "/command/token", msg);\n        return commandId;\n    }\n} |

## 28_Code_DB
| PostgreSQL — schéma minimal |
| --- |
| CREATE TABLE payment (\n  transaction\_id VARCHAR(64) PRIMARY KEY,\n  meter\_id VARCHAR(64) NOT NULL,\n  amount\_xof BIGINT NOT NULL CHECK (amount\_xof > 0),\n  currency CHAR(3) NOT NULL DEFAULT 'XOF',\n  status VARCHAR(20) NOT NULL,\n  created\_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nCREATE TABLE command (\n  command\_id VARCHAR(64) PRIMARY KEY,\n  transaction\_id VARCHAR(64) NOT NULL REFERENCES payment(transaction\_id),\n  meter\_id VARCHAR(64) NOT NULL,\n  dongle\_id VARCHAR(64) NOT NULL,\n  status VARCHAR(20) NOT NULL,\n  sent\_at TIMESTAMPTZ,\n  acknowledged\_at TIMESTAMPTZ,\n  completed\_at TIMESTAMPTZ,\n  error\_code VARCHAR(64)\n);\n\nCREATE TABLE audit\_event (\n  id BIGSERIAL PRIMARY KEY,\n  event\_type VARCHAR(64) NOT NULL,\n  transaction\_id VARCHAR(64),\n  command\_id VARCHAR(64),\n  meter\_id VARCHAR(64),\n  dongle\_id VARCHAR(64),\n  event\_time TIMESTAMPTZ NOT NULL DEFAULT now(),\n  details JSONB\n);\n\nCREATE UNIQUE INDEX ux\_command\_transaction ON command(transaction\_id); |
| NaN |
| Observabilité SQL |
| -- Latence moyenne paiement -> commande terminée\nSELECT AVG(EXTRACT(EPOCH FROM (completed\_at - sent\_at))) AS avg\_seconds\nFROM command\nWHERE status = 'SUCCESS';\n\n-- Taux de succès\nSELECT\n  COUNT(\*) FILTER (WHERE status='SUCCESS') \* 100.0 / NULLIF(COUNT(\*),0)\n  AS success\_rate\_percent\nFROM command;\n\n-- Commandes en erreur\nSELECT command\_id, meter\_id, error\_code, sent\_at\nFROM command\nWHERE status IN ('FAILED','REJECTED')\nORDER BY sent\_at DESC; |

## 29_Code_Simulateurs
| Payment Simulator — FastAPI |
| --- |
| from fastapi import FastAPI\nfrom pydantic import BaseModel, Field\nfrom uuid import uuid4\nfrom datetime import datetime, timezone\n\napp = FastAPI(title="CIE Lab Payment Simulator")\n\nclass Payment(BaseModel):\n    meterId: str\n    amountXof: int = Field(gt=0)\n    currency: str = "XOF"\n\n@app.post("/simulator/payments")\ndef pay(p: Payment):\n    tx = f"TX-{uuid4()}"\n    return {\n        "transactionId": tx,\n        "meterId": p.meterId,\n        "amountXof": p.amountXof,\n        "currency": p.currency,\n        "status": "SUCCESS",\n        "createdAt": datetime.now(timezone.utc).isoformat()\n    }\n\n# En laboratoire: ce simulateur remplace temporairement le vrai PSP/Mobile Money.\n# Il ne doit jamais être utilisé comme service de production. |
| NaN |
| MQTT Publisher — Python |
| import json, uuid\nimport paho.mqtt.client as mqtt\n\nBROKER = "lab-mqtt.local"\nPORT = 8883\nDONGLE\_ID = "DONGLE-LAB-0001"\n\npayload = {\n    "commandId": f"CMD-{uuid.uuid4()}",\n    "meterId": "CIE-LAB-0001",\n    "transactionId": "TX-LAB-0001",\n    "token": "REDACTED",\n    "amountXof": 5000,\n    "issuedAt": "2026-08-23T15:00:00Z",\n    "nonce": str(uuid.uuid4())\n}\n\nclient = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)\nclient.tls\_set(ca\_certs="ca.crt", certfile="client.crt", keyfile="client.key")\nclient.connect(BROKER, PORT)\nclient.publish(\n    f"cie/lab/{DONGLE\_ID}/command/token",\n    json.dumps(payload),\n    qos=1\n)\nclient.disconnect() |
| NaN |
| Mock Meter — FastAPI |
| # Simulateur de compteur pour tester le backend sans matériel.\nfrom fastapi import FastAPI\nfrom pydantic import BaseModel\n\napp = FastAPI(title="CIE Lab Mock Meter")\n\nclass TokenRequest(BaseModel):\n    token: str\n\nSTATE = {"credit": 0, "last\_token": None}\n\n@app.post("/meter/token")\ndef enter\_token(req: TokenRequest):\n    if req.token == "VALID-LAB-TOKEN":\n        if STATE["last\_token"] == req.token:\n            return {"accepted": False, "reason": "DUPLICATE"}\n        STATE["last\_token"] = req.token\n        STATE["credit"] = 5000\n        return {"accepted": True, "credit": 5000}\n    return {"accepted": False, "reason": "INVALID\_TOKEN"} |

## 30_Code_Tests
| pytest — nominal + idempotence |
| --- |
| import requests\n\nBASE = "http://localhost:8080"\n\ndef test\_valid\_payment():\n    r = requests.post(f"{BASE}/api/v1/payments", json={\n        "transactionId": "TX-TEST-001",\n        "meterId": "CIE-LAB-0001",\n        "amountXof": 5000,\n        "currency": "XOF"\n    })\n    assert r.status\_code == 200\n    assert r.json()["status"] in ["SUCCESS", "PENDING"]\n\ndef test\_duplicate\_transaction\_is\_idempotent():\n    payload = {\n        "transactionId": "TX-TEST-DUP",\n        "meterId": "CIE-LAB-0001",\n        "amountXof": 5000,\n        "currency": "XOF"\n    }\n    r1 = requests.post(f"{BASE}/api/v1/payments", json=payload)\n    r2 = requests.post(f"{BASE}/api/v1/payments", json=payload)\n    assert r1.status\_code == 200\n    assert r2.status\_code == 200\n    assert r1.json()["transactionId"] == r2.json()["transactionId"] |
| NaN |
| pytest — panne réseau + duplicate |
| # Tests d'intégration: utiliser des mocks/simulateurs, pas le réseau de production.\ndef test\_network\_loss\_recovery(client, mqtt\_broker):\n    mqtt\_broker.pause()\n    payment = client.pay("CIE-LAB-0001", 5000)\n    assert payment.status in ["PENDING", "QUEUED"]\n\n    mqtt\_broker.resume()\n    result = client.wait\_for\_activation(payment.transaction\_id, timeout=30)\n    assert result.status == "SUCCESS"\n\ndef test\_duplicate\_command\_is\_not\_reexecuted(client):\n    command = client.create\_command(\n        meter\_id="CIE-LAB-0001",\n        token="VALID-LAB-TOKEN"\n    )\n    first = client.dispatch(command)\n    second = client.dispatch\_same\_command(command)\n    assert first.command\_id == second.command\_id\n    assert client.meter\_execution\_count(command.command\_id) == 1 |
| NaN |
| pytest — anti-rejeu |
| # Test de rejeu sur environnement de laboratoire uniquement.\ndef test\_replay\_is\_rejected(client, signed\_command):\n    first = client.send(signed\_command)\n    assert first.status in ["ACCEPTED", "SUCCESS"]\n\n    replay = client.send(signed\_command)\n    assert replay.status in ["REJECTED", "DUPLICATE"]\n\n# Le nonce / commandId / timestamp doit empêcher l'exécution répétée. |

## 31_Code_CI
| GitLab CI |
| --- |
| stages:\n  - lint\n  - unit\_test\n  - integration\_test\n  - security\n  - package\n\nbackend\_tests:\n  stage: unit\_test\n  image: eclipse-temurin:21\n  script:\n    - ./mvnw test\n\npython\_tests:\n  stage: integration\_test\n  image: python:3.12\n  script:\n    - pip install -r requirements.txt\n    - pytest -q\n\nfirmware\_static\_checks:\n  stage: lint\n  image: python:3.12\n  script:\n    - python tools/check\_firmware\_contracts.py\n\nsecurity\_checks:\n  stage: security\n  script:\n    - echo "Run dependency/SAST/secret scans"\n    - echo "Block merge on critical findings" |
