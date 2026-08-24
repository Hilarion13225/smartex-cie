package ci.cie.smartprepaid.recharge.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "recharge", uniqueConstraints = {
        @UniqueConstraint(name = "uk_recharge_idempotency_key", columnNames = {"idempotency_key"})
})
public class Recharge {

    @Id
    @Column(name = "recharge_id", nullable = false, updatable = false)
    private UUID rechargeId = UUID.randomUUID();

    @Column(name = "payment_id", nullable = false)
    private UUID paymentId;

    @Column(name = "meter_id", nullable = false)
    private String meterId;

    @Column(name = "customer_id", nullable = false)
    private String customerId;

    @Column(name = "amount_xof", nullable = false)
    private BigDecimal amountXof;

    /** provider + providerTxId + meterId + amount (ALG-02 étape 2), ou fourni par le client pour une recharge manuelle. */
    @Column(name = "idempotency_key", nullable = false)
    private String idempotencyKey;

    @Column(name = "correlation_id", nullable = false)
    private String correlationId;

    /** hash du token, jamais le token en clair (RG-C-005 / test C05). */
    @Column(name = "token_hash")
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private RechargeStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected Recharge() {
        // JPA
    }

    public Recharge(UUID paymentId, String meterId, String customerId, BigDecimal amountXof,
                     String idempotencyKey, String correlationId) {
        this.paymentId = paymentId;
        this.meterId = meterId;
        this.customerId = customerId;
        this.amountXof = amountXof;
        this.idempotencyKey = idempotencyKey;
        this.correlationId = correlationId;
        this.status = RechargeStatus.CREATED;
    }

    public void transitionTo(RechargeStatus newStatus) {
        this.status = newStatus;
        this.updatedAt = Instant.now();
    }

    public void attachTokenHash(String tokenHash) {
        this.tokenHash = tokenHash;
        this.updatedAt = Instant.now();
    }

    public UUID getRechargeId() { return rechargeId; }
    public UUID getPaymentId() { return paymentId; }
    public String getMeterId() { return meterId; }
    public String getCustomerId() { return customerId; }
    public BigDecimal getAmountXof() { return amountXof; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public String getCorrelationId() { return correlationId; }
    public String getTokenHash() { return tokenHash; }
    public RechargeStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
