-- Compte opérateur CIE de laboratoire, pré-enregistré comme le dongle de
-- V2__seed_lab_device.sql, pour permettre les scénarios de recette T15/audit
-- et les vérifications d'ownership (§07_reconciliation, correctif "trou
-- d'autorisation") sans passer par une inscription CLIENT normale : /auth/register
-- crée toujours un compte CLIENT (voir AuthService#register), un rôle support
-- ne peut donc être obtenu autrement que par un provisioning direct comme celui-ci.
INSERT INTO customer (customer_id, phone_number, display_name, role, password_hash, phone_verified)
VALUES ('00000000-0000-0000-0000-000000000001', '0700000099', 'Support CIE Lab', 'CIE_OPERATOR', NULL, TRUE);
