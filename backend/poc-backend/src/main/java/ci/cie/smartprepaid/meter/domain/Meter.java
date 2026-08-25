package ci.cie.smartprepaid.meter.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Registre des compteurs connus de la CIE (voir V8__meter_registry_and_customer_fields.sql).
 * Volontairement indépendant de {@code device} : un compteur peut exister avant qu'un
 * dongle y soit installé (rollout réel), contrairement au couplage 1:1 supposé jusqu'ici
 * par le reste du PoC (un seul device/meter de labo). Sert de base à la validation de
 * l'association Client<->Compteur à l'inscription (voir AuthService.register).
 */
@Entity
@Table(name = "meter")
public class Meter {

    @Id
    @Column(name = "meter_id", nullable = false, updatable = false)
    private String meterId;

    @Column(name = "label")
    private String label;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Meter() {
        // JPA
    }

    public Meter(String meterId, String label) {
        this.meterId = meterId;
        this.label = label;
    }

    public String getMeterId() { return meterId; }
    public String getLabel() { return label; }
    public Instant getCreatedAt() { return createdAt; }
}
