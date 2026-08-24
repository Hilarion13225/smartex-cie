## 00_README
| Smart Retrofit Metering CIE - Classeur DSI | Unnamed: 1 |
| --- | --- |
| NaN | NaN |
| Rubrique | Description |
| Objet | Classeur ultra detaille pour cadrage, design, technique, algorithmes, dashboards, risques et deploiement sans changement fort de l'existant. |
| Hypothese | Retrofit par dongle/module, compatibilite a qualifier par modele compteur. |
| Modele | Produit SI Smart Metering pilote par DSI, avec gouvernance DSI-Metier-Reseaux-Cyber-Finance-Exploitation. |
| Sources | Feuille 00\_Sources. |
| Usage | Support COPIL, RFI/RFP, ateliers architecture, pilote terrain, suivi DSI. |

## 00_Sources
| Sources et hypothèses | Unnamed: 1 | Unnamed: 2 |
| --- | --- | --- |
| NaN | NaN | NaN |
| Source | URL | Utilisation |
| CIE PEPT - fonctionnement du compteur | https://www.cie.ci/pept/fonctionnement-du-compteur | La page publique CIE mentionne les smart meters, la telegestion, le rechargement et le traitement rapide des anomalies a distance. |
| Ma CIE en ligne | https://macieenligne.ci/ | La page publique presente le suivi consommation, assistance, demandes en ligne et signalement incident. |
| DLMS/COSEM | https://www.dlms.dev/dlms\_cosem/ | DLMS/COSEM est le standard global pour metering intelligent, avec modele objet, couche applicative et profils de communication. |
| STS Association | https://www.sts.org.za/ | STS decrit un systeme de message securise pour le transfert de tokens de prepaiement entre point de vente et compteur. |

## 01_General_Design
| General Design - couches et composants | Unnamed: 1 | Unnamed: 2 | Unnamed: 3 | Unnamed: 4 |
| --- | --- | --- | --- | --- |
| NaN | NaN | NaN | NaN | NaN |
| Couche | Composant | Role | Impact existant | Criticite |
| Terrain | Compteur existant + dongle | Lecture credit/index/evenements et injection si compatible | Faible a moyen | Haute |
| Telecom | SIM/eSIM/APN prive | Transport securise multi-operateur | Faible | Haute |
| IoT | MQTT broker + Device Registry | Messages, identite, commandes, ACK | Moyen | Haute |
| HES | Head-End System | Dialogue compteur/device, normalisation protocoles | Moyen | Haute |
| MDMS | Meter Data Management | Validation, historisation, qualite donnees | Moyen | Haute |
| Payments | Mobile Money + vending | Paiement/token/recharge | Faible a moyen | Haute |
| Digital | App client + portail support | Selfcare, dashboard, support | Faible | Moyenne |
| RUN | NOC/SOC/ITSM | Incidents, SLA, cyber, supervision | Moyen | Haute |

## 02_Detail_Design
| Detail Design - flux cles | Unnamed: 1 | Unnamed: 2 | Unnamed: 3 | Unnamed: 4 | Unnamed: 5 |
| --- | --- | --- | --- | --- | --- |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Flux | Etape | Entree | Controle | Sortie | Fallback |
| Suivi conso | Lecture telemetry | meter\_id, kWh, credit | Dedoublonnage, signature, timestamp | Vue client/CIE | Derniere valeur connue |
| Alerte credit | Calcul autonomie | credit, conso historique | Seuils, anti-spam, consentement | Notification | SMS/USSD si app inactive |
| Recharge auto | Paiement + token | payment\_id, montant | Idempotence, signature, HSM | Compteur credite | Token visible |
| Incident offline | Heartbeat absent | last\_seen, zone | Seuil, cluster, telecom | Ticket L1/L2 | Observation si retour rapide |
| Fraude | Evenement tamper/anomalie | tamper, kWh, tension | Score, preuve, baseline | Alerte SOC/terrain | Revue manuelle |
| Support | Client appelle | phone, contract, meter | Vue 360, statut chaine | Resolution ou escalade | Intervention terrain |

## 03_Technical_Design
| Document technique - composants et code | Unnamed: 1 | Unnamed: 2 | Unnamed: 3 | Unnamed: 4 |
| --- | --- | --- | --- | --- |
| NaN | NaN | NaN | NaN | NaN |
| Composant | Langage/techno | Code requis | Librairies/standards | Tests minimum |
| Firmware dongle | C/C++ FreeRTOS | drivers compteur, modem, OTA, watchdog, crypto | TLS, MQTT, HAL STM32 ou equivalent | unit, hardware-in-loop, power loss |
| Command Service | Java Spring Boot | API commandes, idempotence, retry, audit | Spring Security, OpenAPI, Kafka | unit, integration, resilience |
| Payment Orchestrator | Java ou TypeScript | callbacks, signature, reconciliation, token request | OAuth2, HSM client, REST | contract, replay, double payment |
| Notification Service | TypeScript/Node.js | push, SMS, WhatsApp, templates, anti-spam | Provider SDK, queues | load, template, retry |
| Frontend client | React TypeScript | dashboard, recharge, historique, alertes | PWA, chart library | UX, accessibility |
| Cockpit CIE | React TypeScript | NOC/SOC/support KPIs, filtres, drilldown | RBAC, map, charts | role, performance |
| Data pipeline | Python/SQL/Spark | quality, aggregation, anomaly, forecast | Pandas/Polars/Spark | data quality, scale |
| Observability | Config/IaC | metrics/logs/traces, dashboards | OpenTelemetry, Prometheus, Grafana | SLO, alerting |

## 04_Algorithmes
| Algorithmes - pseudo-code et controles | Unnamed: 1 | Unnamed: 2 | Unnamed: 3 |
| --- | --- | --- | --- |
| NaN | NaN | NaN | NaN |
| Algo | No | Etape | Commentaire |
| ALG-01 Calcul autonomie credit | 1 | Entrer remaining\_credit\_fcfa, historique consommation journaliere, prix/kWh applicable, seuils CIE et seuils client. | A parametrer et valider en pilote |
| ALG-01 Calcul autonomie credit | 2 | Nettoyer historique : supprimer jours incomplets, valeurs nulles, doublons telemetry, jours incident reseau majeur. | A parametrer et valider en pilote |
| ALG-01 Calcul autonomie credit | 3 | Calculer consommation moyenne glissante 7 jours, puis 14 jours si donnees insuffisantes. | A parametrer et valider en pilote |
| ALG-01 Calcul autonomie credit | 4 | Convertir credit restant en energie restante si tarif applicable disponible ; sinon utiliser depense moyenne FCFA/jour. | A parametrer et valider en pilote |
| ALG-01 Calcul autonomie credit | 5 | Calculer autonomie = credit\_rest / moyenne\_journaliere ; borner a 0 si credit negatif ou nul. | A parametrer et valider en pilote |
| ALG-01 Calcul autonomie credit | 6 | Classer : NORMAL > 7 jours, WATCH <= 7, LOW <= 3, CRITICAL <= 1, CUT\_RISK <= 0.125. | A parametrer et valider en pilote |
| ALG-01 Calcul autonomie credit | 7 | Appliquer anti-spam : ne pas renvoyer le meme niveau si deja notifie recemment sauf aggravation. | A parametrer et valider en pilote |
| ALG-01 Calcul autonomie credit | 8 | Emettre evenement LOW\_CREDIT avec risk\_level, autonomy\_days, confidence\_score, recommended\_amount. | A parametrer et valider en pilote |
| ALG-02 Recharge automatique avec idempotence | 1 | Recevoir callback paiement signe ; verifier signature fournisseur et statut final. | A parametrer et valider en pilote |
| ALG-02 Recharge automatique avec idempotence | 2 | Construire idempotency\_key = provider + provider\_tx\_id + meter\_id + amount. | A parametrer et valider en pilote |
| ALG-02 Recharge automatique avec idempotence | 3 | Si idempotency\_key deja traitee avec SUCCESS, retourner statut existant sans creer nouvelle recharge. | A parametrer et valider en pilote |
| ALG-02 Recharge automatique avec idempotence | 4 | Verifier association customer\_id/meter\_id, statut compteur, eligibilite autorecharge et plafonds. | A parametrer et valider en pilote |
| ALG-02 Recharge automatique avec idempotence | 5 | Demander generation token ou ordre recharge au systeme prepaiement/HSM selon architecture. | A parametrer et valider en pilote |
| ALG-02 Recharge automatique avec idempotence | 6 | Creer command\_id et correlation\_id ; pousser commande au HES/IoT avec sequence monotone. | A parametrer et valider en pilote |
| ALG-02 Recharge automatique avec idempotence | 7 | Attendre ACK technique puis ACK metier ; sinon retry exponentiel avec limite N et dead-letter queue. | A parametrer et valider en pilote |
| ALG-02 Recharge automatique avec idempotence | 8 | Si echec definitif technique, basculer fallback : notification token visible ou ouverture ticket L2. | A parametrer et valider en pilote |
| ALG-02 Recharge automatique avec idempotence | 9 | Journaliser tous les statuts et notifier client avec statut clair. | A parametrer et valider en pilote |
| ALG-03 Detection compteur offline | 1 | Chaque device publie heartbeat periodique avec timestamp, RSSI, operateur, batterie/alim, firmware. | A parametrer et valider en pilote |
| ALG-03 Detection compteur offline | 2 | Job de controle compare now - last\_seen au seuil par modele/zone. | A parametrer et valider en pilote |
| ALG-03 Detection compteur offline | 3 | Si depassement seuil, verifier si incident telecom massif sur la zone. | A parametrer et valider en pilote |
| ALG-03 Detection compteur offline | 4 | Classifier : OFFLINE\_INDIVIDUAL, OFFLINE\_CLUSTER, TELECOM\_SUSPECT, POWER\_OUTAGE\_SUSPECT. | A parametrer et valider en pilote |
| ALG-03 Detection compteur offline | 5 | Creer ticket seulement si depassement duree ou recurrence ; sinon alerte observation. | A parametrer et valider en pilote |
| ALG-03 Detection compteur offline | 6 | Prioriser selon criticite client, nombre de clients impactes, historique fraude, SLA contractuel. | A parametrer et valider en pilote |
| ALG-03 Detection compteur offline | 7 | Fermer automatiquement si retour heartbeat stable pendant fenetre configuree. | A parametrer et valider en pilote |
| ALG-04 Scoring fraude et anomalies | 1 | Collecter event tamper, ouverture capot, magnetic, reverse energy, baisse brutale kWh, incoherence tension/courant. | A parametrer et valider en pilote |
| ALG-04 Scoring fraude et anomalies | 2 | Calculer score par ponderation : tamper direct fort, baisse brutale moyen, offline recurrent moyen, tension incoherente moyen. | A parametrer et valider en pilote |
| ALG-04 Scoring fraude et anomalies | 3 | Comparer a baseline historique client et baseline quartier pour limiter faux positifs. | A parametrer et valider en pilote |
| ALG-04 Scoring fraude et anomalies | 4 | Classer : LOW observation, MEDIUM revue support, HIGH investigation terrain, CRITICAL SOC + terrain. | A parametrer et valider en pilote |
| ALG-04 Scoring fraude et anomalies | 5 | Associer preuve : telemetry, event log, photo intervention, historique commandes. | A parametrer et valider en pilote |
| ALG-04 Scoring fraude et anomalies | 6 | Ne jamais couper automatiquement sur score seul sans regle metier validee et procedure conforme. | A parametrer et valider en pilote |
| ALG-05 Priorisation incidents support | 1 | Entrer incident\_type, severity, client\_segment, zone, age\_ticket, recurrence, SLA\_due\_at. | A parametrer et valider en pilote |
| ALG-05 Priorisation incidents support | 2 | Calculer urgency = temps restant SLA + criticite service + impact client + risque securite. | A parametrer et valider en pilote |
| ALG-05 Priorisation incidents support | 3 | Calculer score = 40% criticite + 25% SLA + 20% impact zone + 15% recurrence. | A parametrer et valider en pilote |
| ALG-05 Priorisation incidents support | 4 | Trier files L1/L2/terrain par score, puis par anciennete. | A parametrer et valider en pilote |
| ALG-05 Priorisation incidents support | 5 | Escalader L2 si L1 ne peut confirmer status payment/command/ACK en delai configure. | A parametrer et valider en pilote |
| ALG-05 Priorisation incidents support | 6 | Escalader incident majeur si cluster geographique ou volume depasse seuil. | A parametrer et valider en pilote |

## 05_Dashboard_Client
| Dashboard Client - prototype simple | Unnamed: 1 | Unnamed: 2 | Unnamed: 3 | Unnamed: 4 | Unnamed: 5 | Unnamed: 6 | Unnamed: 7 | Unnamed: 8 | Unnamed: 9 | Unnamed: 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN |
| Widget | Mesure | UX | Regle couleur | Action client | NaN | NaN | NaN | NaN | Prototype KPI | NaN |
| Solde | Credit FCFA/kWh | Carte principale | Vert >7j, orange <=3j, rouge <=1j | Recharge rapide | NaN | NaN | NaN | NaN | Solde FCFA | 4500.0 |
| Autonomie | Jours/heures restants | Phrase simple | Selon risque | Planifier recharge | NaN | NaN | NaN | NaN | Conso jour kWh | 3.2 |
| Consommation | Courbe jour/semaine/mois | Graphique clair | Variation importante en orange | Comprendre usage | NaN | NaN | NaN | NaN | Autonomie jours | 5.0 |
| Alerte | Credit faible / incident | Bandeau | Orange/rouge | Payer ou contacter support | NaN | NaN | NaN | NaN | Alertes actives | 1.0 |
| Recharge | Montants favoris | Boutons 1000/2000/5000/10000 | NaN | Mobile Money | NaN | NaN | NaN | NaN | Recharges mois | 4.0 |
| Statut | Paiement, commande, ACK | Timeline 4 etapes | Vert si termine | Attendre ou saisir token | NaN | NaN | NaN | NaN | NaN | NaN |

## 06_Dashboard_CIE
| Dashboard CIE - exploitation et fournisseur | Unnamed: 1 | Unnamed: 2 | Unnamed: 3 | Unnamed: 4 | Unnamed: 5 | Unnamed: 6 | Unnamed: 7 | Unnamed: 8 | Unnamed: 9 | Unnamed: 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN |
| Domaine | KPI | Formule/definition | Seuil RAG | Action | NaN | NaN | NaN | NaN | Exemple cockpit | NaN |
| Parc | % online | devices online / devices installes | Vert >=98%, orange >=95%, rouge <95% | Analyser zones offline | NaN | NaN | NaN | NaN | Online | 482000.0 |
| Recharge | Taux succes | recharges succes / recharges totales | Vert >=99%, orange >=97%, rouge <97% | Escalade paiement/HES | NaN | NaN | NaN | NaN | Offline | 13000.0 |
| Commande | P95 delai | 95e percentile paiement -> ACK final | Vert <60s, orange <120s, rouge >=120s | Analyse latence | NaN | NaN | NaN | NaN | Low credit | 5000.0 |
| Incident | Backlog SLA | tickets ouverts depassant SLA | Vert 0, orange <5%, rouge >=5% | Renfort support | NaN | NaN | NaN | NaN | Incidents | 1500.0 |
| Telecom | RSSI faible | devices sous seuil signal | Vert <5%, orange <10%, rouge >=10% | Operateur terrain | NaN | NaN | NaN | NaN | Failed recharge | 312.0 |
| Fraude | Alertes high | tamper/high score ouverts | Selon politique | Investigation | NaN | NaN | NaN | NaN | NaN | NaN |
| Cyber | Certificats expirants | certs <30j | Vert 0 | Rotation certificat | NaN | NaN | NaN | NaN | NaN | NaN |

## 07_Roadmap
| Roadmap deploiement sans changement fort | Unnamed: 1 | Unnamed: 2 | Unnamed: 3 | Unnamed: 4 |
| --- | --- | --- | --- | --- |
| NaN | NaN | NaN | NaN | NaN |
| Phase | Objectif | Livrables | Go/No Go | Responsable |
| 0 | Cadrage | Charte produit, gouvernance, perimetre, RFI | Sponsor + DSI valides | DSI |
| 1 | Qualification parc | Matrice compatibilite, protocole, risque, cout | Modeles prioritaires qualifies | Architecture/IoT |
| 2 | Prototype lab | Lecture, injection, fallback, security baseline | Succès lab et securite | Fournisseur + DSI |
| 3 | Pilote terrain | 100-500 compteurs, support, dashboards | KPI mini atteints | Programme |
| 4 | Pre-industrialisation | 2k-10k, provisioning, RUN, ITSM | Operations stables | Exploitation |
| 5 | Industrialisation | deploiement par lots, formation agences | SLA et ROI controles | Direction programme |

## 08_Risques_RACI
| Risques, controles et RACI | Unnamed: 1 | Unnamed: 2 | Unnamed: 3 | Unnamed: 4 |
| --- | --- | --- | --- | --- |
| NaN | NaN | NaN | NaN | NaN |
| Risque | Impact | Probabilite | Mitigation | Owner |
| Incompatibilite modele compteur | Injection impossible | Moyenne | Qualification + fallback token visible | IoT/HES |
| Couverture telecom insuffisante | Donnees retardees | Moyenne | Multi-operateur, store-and-forward, APN prive | Telecom |
| Double recharge | Perte financiere | Faible | Idempotence, reconciliation, audit | Paiement |
| Fraude token/commande | Perte revenu | Moyenne | HSM, signature, sequence, monitoring | RSSI |
| Vendor lock-in | Dependance fournisseur | Moyenne | API ouvertes, export donnees, reversibilite | DSI |
| Surcharge support | Mauvaise experience | Moyenne | Selfcare, runbooks, L1/L2, knowledge base | Support |
| Donnees incorrectes | Mauvaise decision | Moyenne | Quality rules, MDMS, corrections auditables | Data |

## 09_Backlog_API_Code
| Backlog API et code requis | Unnamed: 1 | Unnamed: 2 | Unnamed: 3 | Unnamed: 4 |
| --- | --- | --- | --- | --- |
| NaN | NaN | NaN | NaN | NaN |
| Epic | User Story | API/Service | Langage | Critere acceptation |
| Suivi conso | En tant que client, je consulte mon solde et autonomie | GET /customers/{id}/energy-status | TypeScript/Java | Solde, autonomie, dernier index, timestamp retournes |
| Alerte | En tant que client, je recois une alerte avant coupure | Notification Service | TypeScript | Alerte envoyee selon seuil et consentement |
| Recharge | En tant que client, je recharge et vois le statut | POST /recharges | Java | payment\_id et correlation\_id traces |
| Support | En tant qu'operateur, je vois la chaine paiement->compteur | GET /support/timeline | Java/React | Timeline complete et filtrable |
| CIE cockpit | En tant que superviseur, je vois parc et incidents | GET /operations/kpis | Java/React | KPI par zone/periode/type |
| Device | En tant que DSI, je gere firmware et certificats | Device Registry APIs | Java | RBAC + audit + statut device |

## EXEC_DG_V2
| Axe | Message DG | Décision attendue | Indicateur de succès |
| --- | --- | --- | --- |
| Vision | Créer une plateforme Smart Prepaid sans remplacement massif des compteurs existants. | Valider un programme transverse DSI-Réseaux-Métier-Cyber-Finance. | Prototype puis pilote validés sur données terrain. |
| Client | Suivi consommation, alertes avant coupure, recharge Mobile Money, injection automatique si compatible. | Valider parcours client simple et multicanal. | Taux alertes reçues, taux recharge réussie, baisse appels. |
| CIE | Supervision temps réel, incidents automatisés, traçabilité recharge, détection anomalies. | Valider cockpit CIE et ITSM. | Taux compteurs online, SLA incidents, taux commandes OK. |
| Risque | Compatibilité compteur et protocole non garantie sans qualification. | Démarrer par inventaire et tests terrain. | % modèles qualifiés et % retrofit compatible. |
| Maîtrise | La CIE garde données, API, sécurité, règles métier, monitoring et réversibilité. | Valider principes d’architecture et contrats fournisseurs. | Niveau de documentation, réversibilité, audit sécurité. |

## JAVA_SPEC
| Composant | Responsabilité | Classes clés | API/Events | Exigences NFR |
| --- | --- | --- | --- | --- |
| recharge-core-service | Orchestration recharge bout en bout | Recharge, Payment, Token, MeterCommand, RechargePolicy | POST /recharges; RechargeRequested; PaymentConfirmed | Idempotence, transaction, audit, correlation\_id |
| command-service | Commandes HES/dongle/compteur | MeterCommand, RetryPolicy, CommandAck | CommandSent; CommandAcked; CommandFailed | Retry contrôlé, timeout, anti-doublon |
| meter-registry-service | Référentiel client-compteur-device | Customer, Meter, Device, SimProfile | GET /meters/status | Qualité référentiel, historique de compatibilité |
| incident-service | Création incidents règles et alertes | Incident, Severity, AssignmentRule | IncidentCreated; IncidentClosed | SLA, priorisation, intégration ITSM |
| rules-engine-service | Prédiction et seuils | Prediction, AlertLevel, AutoRechargeProfile | LowCreditPredicted | Règles configurables, explicabilité |
| audit-service | Traçabilité critique | AuditRecord, Actor, Operation | AuditAppended | Append-only, horodatage, non répudiation |

## NODEJS_SPEC
| Composant | Responsabilité | Modules TypeScript | API/Canaux | Exigences NFR |
| --- | --- | --- | --- | --- |
| customer-bff | Dashboard mobile/web client | CustomerDashboardController, DashboardService | GET /customer-dashboard/:id | Réponse simple, cache court, sécurité JWT |
| notification-service | SMS/WhatsApp/Push | NotificationRouter, SmsProvider, PushProvider | LOW\_CREDIT, RECHARGE\_SUCCESS | Priorité, retry, préférence client |
| payment-adapter-service | Webhooks Mobile Money | PaymentWebhookController, PaymentNormalizer | PaymentConfirmed, PaymentFailed | Idempotence webhook, signature, audit |
| portal-cie-bff | Cockpit opérateur CIE | IncidentController, MeterSearchService | GET /ops/incidents | RBAC, pagination, recherche rapide |
| dashboard-api | Agrégations KPI | KpiService, RealtimeEventsGateway | WebSocket/SSE optionnel | Latence faible, lecture read model |

## ALGO_PREDICTION
| Étape | Nom | Détail | Sortie |
| --- | --- | --- | --- |
| 1 | Contrôle qualité données | Vérifier âge dernière lecture, valeurs négatives, historique minimum. | Données valides ou statut DEGRADED |
| 2 | Nettoyage | Supprimer valeurs négatives, plafonner outliers, marquer anomalies. | Série nettoyée |
| 3 | Moyenne pondérée | 0,65 x moyenne 7j + 0,35 x moyenne 30j. | Consommation journalière pondérée |
| 4 | Ajustement | Appliquer saisonnalité et marge de prudence. | Consommation prudente |
| 5 | Autonomie | Crédit restant / consommation prudente. | Nombre de jours restants |
| 6 | Alerte | Classer Normal, J7, J3, J1, H3. | Niveau alerte |
| 7 | Publication | Sauver prediction\_id et publier événement. | Dashboard et notification |

## ALGO_AUTO_RECHARGE
| Étape | Nom | Détail | Sortie |
| --- | --- | --- | --- |
| 1 | Éligibilité | Auto-recharge activée, compteur actif, moyen paiement valide. | OK ou stop |
| 2 | Déclencheur | Crédit sous seuil ou prédiction critique. | Trigger validé |
| 3 | Anti-doublon | Calcul idempotency\_key et recherche fenêtre. | Aucune recharge doublon |
| 4 | Plafonds | Contrôle plafond journalier/mensuel et fraude. | OK ou stop |
| 5 | Paiement | Demande débit Mobile Money. | PAYMENT\_PENDING |
| 6 | Callback | Confirmer ou rejeter paiement. | PAYMENT\_CONFIRMED/FAILED |
| 7 | Token/commande | Générer token/commande et pousser vers compteur. | COMMAND\_SENT |
| 8 | ACK | Interpréter succès, timeout ou rejet. | CREDIT\_APPLIED ou incident |
| 9 | Notification | Informer client et mettre à jour dashboard. | Message final |

## DASHBOARDS_V2
| Vue | KPI/Card | Description | Audience |
| --- | --- | --- | --- |
| Client | Crédit disponible | Solde, autonomie, dernière mise à jour | Client |
| Client | Consommation | Jour/semaine/mois, courbe simple | Client |
| Client | Alertes | Crédit faible, paiement échoué, recharge réussie | Client |
| Client | Auto-recharge | Statut, seuil, montant, moyen paiement | Client |
| CIE | Parc connecté | Online/offline, qualité réseau, zones | Exploitation |
| CIE | Recharges | Succès, échecs, temps moyen, transactions en cours | Métier/Finance |
| CIE | Incidents | Type, priorité, SLA, groupe assigné | Support |
| CIE | Sécurité | Fraudes, tamper, devices suspects | Cyber/SOC |

## API_CONTRACTS
| Endpoint | Méthode | Responsable | Entrées | Sorties | Sécurité |
| --- | --- | --- | --- | --- | --- |
| /api/v1/recharges | POST | Java recharge-core | customerId,meterId,amount,channel,idempotencyKey | rechargeId,status,correlationId | OAuth2, mTLS interne |
| /api/v1/recharges/{id} | GET | Java recharge-core | rechargeId | paymentStatus,commandStatus,finalStatus | OAuth2, RBAC |
| /api/v1/meters/{id}/status | GET | Java meter-registry | meterId | onlineStatus,credit,lastReadingAt | OAuth2, RBAC |
| /api/v1/customer-dashboard/{id} | GET | Node customer-bff | customerId | solde,conso,alertes,recharges | JWT client |
| /api/v1/mobile-money/webhook | POST | Node payment-adapter | providerPayload,signature | ack | Signature provider, IP allowlist |
| /api/v1/incidents | POST | Java incident-service | eventType,meterId,severity,payload | incidentId,priority | Service account |

## KPI_DG_SIMPLE
| Mois | Compteurs connectés | Taux succès recharge | Incidents clôturés SLA |
| --- | --- | --- | --- |
| M1 | 50 | 0.920 | 0.70 |
| M2 | 200 | 0.950 | 0.78 |
| M3 | 500 | 0.970 | 0.83 |
| M4 | 1000 | 0.980 | 0.88 |
| M5 | 5000 | 0.985 | 0.91 |
| M6 | 10000 | 0.990 | 0.94 |
