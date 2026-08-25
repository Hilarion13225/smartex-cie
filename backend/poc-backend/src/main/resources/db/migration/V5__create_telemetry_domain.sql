-- Domaine telemetry (ALG-01 simplifie "Calcul autonomie credit", voir
-- docs/03_architecture-v2-classeur.md et docs/05_reconciliation-api-frontend-backend.md §3).
-- Un releve = un point de mesure du credit restant d'un meter a un instant donne,
-- collecte periodiquement par TelemetryCollector via meterAdapter.readCredit().

CREATE TABLE meter_reading (
    reading_id      UUID PRIMARY KEY,
    meter_id        VARCHAR(64) NOT NULL,
    credit_balance  NUMERIC(14,2) NOT NULL,
    captured_at     TIMESTAMPTZ NOT NULL
);

-- CreditAutonomyService interroge systematiquement "les releves des N derniers
-- jours pour un meter donne, dans l'ordre chronologique" -- index compose pour
-- servir cette requete directement sans tri en memoire.
CREATE INDEX idx_meter_reading_meter_id_captured_at ON meter_reading (meter_id, captured_at);
