-- Suspension de compte (module de gestion admin, voir CustomerController) : un compte
-- suspendu ne peut plus se connecter (login rejeté avant meme l'envoi d'un OTP, voir
-- AuthService.login) sans etre supprime -- reversible via reactivation.
ALTER TABLE customer ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
