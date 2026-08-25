-- Domaine customer/auth (voir docs/05_reconciliation-api-frontend-backend.md §8).
-- Mécanisme OTP-only : password_hash est collecté et stocké (formulaire d'inscription
-- frontend) mais réservé à un usage futur (2FA/récupération de compte) -- non utilisé
-- pour authentifier en Phase 2, voir customer/service/AuthService.java.

CREATE TABLE customer (
    customer_id     UUID PRIMARY KEY,
    phone_number    VARCHAR(32) NOT NULL,
    display_name    VARCHAR(128) NOT NULL,
    role            VARCHAR(32) NOT NULL,
    password_hash   VARCHAR(255),
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_customer_phone_number UNIQUE (phone_number)
);

-- Défis OTP : jamais le code en clair, uniquement son hash (même logique que le
-- masquage du token compteur, RG-C-005). Une ligne par envoi ; consumed=true une
-- fois vérifiée avec succès, pour empêcher le rejeu du même code.
CREATE TABLE otp_challenge (
    otp_id          UUID PRIMARY KEY,
    phone_number    VARCHAR(32) NOT NULL,
    code_hash       VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_challenge_phone ON otp_challenge(phone_number, created_at DESC);
