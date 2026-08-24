package ci.cie.smartprepaid.payment.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "payment", uniqueConstraints = {
        @UniqueConstraint(name = "uk_payment_provider_tx", columnNames = {"provider", "provider_tx_id"})
})
public class Payment {

    @Id
    @Column(name = "payment_id", nullable = false, updatable = false)
    private UUID paymentId = UUID.randomUUID();

    @Column(name = "meter_id", nullable = false)
    private String meterId;

    @Column(name = "customer_id", nullable = false)
    private String customerId;

    @Column(name = "provider", nullable = false)
    private String provider; // ex: PAYMENT_SIMULATOR, ORANGE_MONEY, MTN_MONEY...

    @Column(name = "provider_tx_id", nullable = false)
    private String providerTxId;

    @Column(name = "amount_xof", nullable = false)
    private BigDecimal amountXof;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PaymentStatus status;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Payment() {
        // JPA
    }

    public Payment(String meterId, String customerId, String provider, String providerTxId,
                    BigDecimal amountXof, PaymentStatus status) {
        this.meterId = meterId;
        this.customerId = customerId;
        this.provider = provider;
        this.providerTxId = providerTxId;
        this.amountXof = amountXof;
        this.status = status;
        if (status == PaymentStatus.CONFIRMED) {
            this.confirmedAt = Instant.now();
        }
    }

    public UUID getPaymentId() { return paymentId; }
    public String getMeterId() { return meterId; }
    public String getCustomerId() { return customerId; }
    public String getProvider() { return provider; }
    public String getProviderTxId() { return providerTxId; }
    public BigDecimal getAmountXof() { return amountXof; }
    public PaymentStatus getStatus() { return status; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
