package ci.cie.smartprepaid.recharge.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "command")
public class MeterCommand {

    @Id
    @Column(name = "command_id", nullable = false, updatable = false)
    private UUID commandId = UUID.randomUUID();

    @Column(name = "recharge_id", nullable = false)
    private UUID rechargeId;

    @Column(name = "device_id", nullable = false)
    private String deviceId;

    @Column(name = "correlation_id", nullable = false)
    private String correlationId;

    /** hash du payload (jamais le token en clair), pour vérification/anti-rejeu. */
    @Column(name = "payload_hash", nullable = false)
    private String payloadHash;

    /** séquence monotone par device — anti-rejeu (§12 Securite). */
    @Column(name = "sequence", nullable = false)
    private long sequence;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private CommandStatus status = CommandStatus.PENDING;

    @Column(name = "retry_count", nullable = false)
    private int retryCount = 0;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "ack_at")
    private Instant ackAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    protected MeterCommand() {
        // JPA
    }

    public MeterCommand(UUID rechargeId, String deviceId, String correlationId, String payloadHash,
                         long sequence, Instant expiresAt) {
        this.rechargeId = rechargeId;
        this.deviceId = deviceId;
        this.correlationId = correlationId;
        this.payloadHash = payloadHash;
        this.sequence = sequence;
        this.expiresAt = expiresAt;
    }

    public void markSent() {
        this.status = CommandStatus.SENT;
        this.sentAt = Instant.now();
    }

    public void markAcked(CommandStatus finalStatus) {
        this.status = finalStatus;
        this.ackAt = Instant.now();
    }

    public void incrementRetry() {
        this.retryCount++;
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public UUID getCommandId() { return commandId; }
    public UUID getRechargeId() { return rechargeId; }
    public String getDeviceId() { return deviceId; }
    public String getCorrelationId() { return correlationId; }
    public String getPayloadHash() { return payloadHash; }
    public long getSequence() { return sequence; }
    public CommandStatus getStatus() { return status; }
    public int getRetryCount() { return retryCount; }
    public Instant getSentAt() { return sentAt; }
    public Instant getAckAt() { return ackAt; }
    public Instant getExpiresAt() { return expiresAt; }
}
