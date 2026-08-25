-- Compte CIE_ADMIN de laboratoire, même pattern que V4__seed_lab_operator.sql (voir ce
-- fichier pour le détail complet du raisonnement) : le module de gestion admin
-- (création directe d'un compte opérateur/admin, changement de rôle, suspension --
-- voir CustomerController) est réservé CIE_ADMIN/DSI_ADMIN, et aucun de ces deux rôles
-- n'existe autrement que par provisioning direct comme celui-ci (/auth/register crée
-- toujours un compte CLIENT).
--
-- IDENTIFIANTS DE LABORATOIRE UNIQUEMENT — voir README §Authentification. Même garde-fou
-- que V4 : ce fichier vit dans db/migration-dev/, appliqué uniquement sous le profil Spring
-- "dev". Aucun raccourci d'authentification : connexion par le flux OTP normal.
INSERT INTO customer (customer_id, phone_number, display_name, role, password_hash, phone_verified)
VALUES ('00000000-0000-0000-0000-000000000002', '0700000098', 'Admin CIE Lab', 'CIE_ADMIN', NULL, TRUE);
