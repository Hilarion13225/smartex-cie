package ci.cie.smartprepaid.audit.repo;

import ci.cie.smartprepaid.audit.domain.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {
    List<AuditEvent> findByCorrelationIdOrderByTimestampAsc(String correlationId);
    List<AuditEvent> findByEntityTypeAndEntityIdOrderByTimestampAsc(String entityType, String entityId);
}
