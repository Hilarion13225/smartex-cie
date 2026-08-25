package ci.cie.smartprepaid.telemetry.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Un relevé de crédit restant pour un meter, à un instant donné (voir
 * TelemetryCollector). Sert de base à CreditAutonomyService (ALG-01 simplifié)
 * pour reconstruire une consommation réelle entre deux relevés.
 */
@Entity
@Table(name = "meter_reading")
public class MeterReading {

    @Id
    @Column(name = "reading_id", nullable = false, updatable = false)
    private UUID readingId = UUID.randomUUID();

    @Column(name = "meter_id", nullable = false)
    private String meterId;

    @Column(name = "credit_balance", nullable = false)
    private BigDecimal creditBalance;

    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt;

    protected MeterReading() {
        // JPA
    }

    public MeterReading(String meterId, BigDecimal creditBalance, Instant capturedAt) {
        this.meterId = meterId;
        this.creditBalance = creditBalance;
        this.capturedAt = capturedAt;
    }

    public UUID getReadingId() { return readingId; }
    public String getMeterId() { return meterId; }
    public BigDecimal getCreditBalance() { return creditBalance; }
    public Instant getCapturedAt() { return capturedAt; }
}
