-- Le provider (WAVE/ORANGE_MONEY/MTN_MONEY/MOOV_MONEY) choisi par le client pour une
-- recharge manuelle (POST /api/v1/recharges) n'était persisté nulle part : cette route ne
-- crée jamais de ligne `payment` (voir RechargeOrchestrator.startManual), donc le lookup
-- via payment_id utilisé pour l'historique (RechargeController.toSummary) retombait
-- toujours à null -- l'écran Transactions affichait "PAYMENT_SIMULATOR"/vide pour toute
-- recharge réelle, quel que soit l'opérateur réellement sélectionné par le client.
ALTER TABLE recharge ADD COLUMN provider VARCHAR(255);
