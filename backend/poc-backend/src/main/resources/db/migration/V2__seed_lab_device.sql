-- Compteur/dongle de laboratoire par défaut, utilisé par les tests T01-T15
-- et par les simulateurs (mock-dongle s'enregistre sous cet identifiant).
INSERT INTO device (device_id, meter_id, cert_id, firmware_version, status)
VALUES ('DONGLE-LAB-0001', 'CIE-LAB-0001', 'LAB-CERT-0001', '0.1.0-poc', 'UNKNOWN');
