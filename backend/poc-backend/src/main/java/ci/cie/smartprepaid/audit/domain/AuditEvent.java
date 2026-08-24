package ci.cie.smartprepaid.audit.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Journal append-only. Ne jamais exposer de champ "update" sur cette entité :
 * une correction se fait en ajoutant un nouvel événement, jamais en modifiant
 * un événement existant (exigence RG P6 / test T15 / test C05 masquage token).
 */
@Entity
@Table(name = "audit_event")
public class AuditEvent {

    @Id
    @Column(name = "audit_id", nullable = false, updatable = false)
    private UUID auditId = UUID.randomUUID();

    @Column(name = "correlation_id", nullable = false)
    private String correlationId;

    @Column(name = "actor", nullable = false)
    private String actor; // ex: payment-service, recharge-orchestrator, mqtt-gateway

    @Column(name = "action", nullable = false)
    private String action; // ex: PAYMENT_CONFIRMED, COMMAND_SENT, COMMAND_ACKED

    @Column(name = "entity_type")
    private String entityType; // ex: PAYMENT, RECHARGE, COMMAND, DEVICE

    @Column(name = "entity_id")
    private String entityId;

    @Column(name = "result")
    private String result; // ex: SUCCESS, FAILED, REJECTED

    @Column(name = "error_code")
    private String errorCode;

    @Column(name = "details", length = 2000)
    private String details; // JSON libre, JAMAIS de token en clair ici (voir masquage)

    @Column(name = "timestamp", nullable = false)
    private Instant timestamp = Instant.now();

    protected AuditEvent() {
        // JPA
    }

    public AuditEvent(String correlationId, String actor, String action, String entityType,
                       String entityId, String result, String errorCode, String details) {
        this.correlationId = correlationId;
        this.actor = actor;
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.result = result;
        this.errorCode = errorCode;
        this.details = details;
    }

    public UUID getAuditId() { return auditId; }
    public String getCorrelationId() { return correlationId; }
    public String getActor() { return actor; }
    public String getAction() { return action; }
    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
    public String getResult() { return result; }
    public String getErrorCode() { return errorCode; }
    public String getDetails() { return details; }
    public Instant getTimestamp() { return timestamp; }
}
