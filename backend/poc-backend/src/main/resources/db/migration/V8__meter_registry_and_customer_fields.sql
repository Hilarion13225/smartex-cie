-- Registre des compteurs connus de la CIE (independant de `device`) : un compteur peut
-- exister avant qu'un dongle y soit installe (rollout reel typique), contrairement au
-- couplage 1:1 compteur<->dongle suppose jusqu'ici par tout le reste du PoC. Base de la
-- vraie association Client<->Compteur (customer.meter_id ci-dessous) et de la gestion
-- admin ("liste de compteurs").
CREATE TABLE meter (
    meter_id    VARCHAR(64) PRIMARY KEY,
    label       VARCHAR(128),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Le seul compteur de labo existant (V2__seed_lab_device.sql) doit rester enregistrable --
-- sans cette ligne, meme CIE-LAB-0001 echouerait desormais la validation d'inscription
-- (meterId inconnu du registre).
INSERT INTO meter (meter_id, label) VALUES ('CIE-LAB-0001', 'Compteur de laboratoire');

-- email : necessaire pour l'envoi du code OTP par email (Brevo). meter_id/contract_id :
-- association reelle saisie a l'inscription, verifiee contre le registre `meter` (voir
-- AuthService.register) -- UNIQUE car un compteur ne peut appartenir qu'a un seul client.
ALTER TABLE customer ADD COLUMN email VARCHAR(255);
ALTER TABLE customer ADD COLUMN contract_id VARCHAR(64);
ALTER TABLE customer ADD COLUMN meter_id VARCHAR(64) REFERENCES meter(meter_id);
ALTER TABLE customer ADD CONSTRAINT uk_customer_meter_id UNIQUE (meter_id);
