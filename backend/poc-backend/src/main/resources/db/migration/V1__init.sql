-- Schéma initial PoC Laboratoire (voir docs/02_developer-pack-poc.md §11_DB
-- et docs/03_architecture-v2-classeur.md §API_CONTRACTS / modèle de données).

CREATE TABLE payment (
    payment_id      UUID PRIMARY KEY,
    meter_id        VARCHAR(64) NOT NULL,
    customer_id     VARCHAR(64) NOT NULL,
    provider        VARCHAR(64) NOT NULL,
    provider_tx_id  VARCHAR(128) NOT NULL,
    amount_xof      NUMERIC(14,2) NOT NULL,
    status          VARCHAR(32) NOT NULL,
    confirmed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_payment_provider_tx UNIQUE (provider, provider_tx_id)
);

CREATE TABLE device (
    device_id        VARCHAR(64) PRIMARY KEY,
    meter_id         VARCHAR(64) NOT NULL UNIQUE,
    cert_id          VARCHAR(128),
    firmware_version VARCHAR(32),
    status           VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    last_seen        TIMESTAMPTZ
);

CREATE TABLE recharge (
    recharge_id      UUID PRIMARY KEY,
    payment_id       UUID NOT NULL,
    meter_id         VARCHAR(64) NOT NULL,
    customer_id      VARCHAR(64) NOT NULL,
    amount_xof       NUMERIC(14,2) NOT NULL,
    idempotency_key  VARCHAR(256) NOT NULL,
    correlation_id   VARCHAR(64) NOT NULL,
    token_hash       VARCHAR(128),
    status           VARCHAR(32) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_recharge_idempotency_key UNIQUE (idempotency_key)
);

CREATE TABLE command (
    command_id      UUID PRIMARY KEY,
    recharge_id     UUID NOT NULL REFERENCES recharge(recharge_id),
    device_id       VARCHAR(64) NOT NULL,
    correlation_id  VARCHAR(64) NOT NULL,
    payload_hash    VARCHAR(128) NOT NULL,
    sequence        BIGINT NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    retry_count     INT NOT NULL DEFAULT 0,
    sent_at         TIMESTAMPTZ,
    ack_at          TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_command_device_sequence ON command(device_id, sequence DESC);
CREATE INDEX idx_command_recharge ON command(recharge_id);

CREATE TABLE audit_event (
    audit_id        UUID PRIMARY KEY,
    correlation_id  VARCHAR(64) NOT NULL,
    actor           VARCHAR(64) NOT NULL,
    action          VARCHAR(64) NOT NULL,
    entity_type     VARCHAR(32),
    entity_id       VARCHAR(64),
    result          VARCHAR(32),
    error_code      VARCHAR(64),
    details         VARCHAR(2000),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_correlation ON audit_event(correlation_id);
CREATE INDEX idx_audit_entity ON audit_event(entity_type, entity_id);
