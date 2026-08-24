package ci.cie.smartprepaid.audit.service;

import ci.cie.smartprepaid.audit.domain.AuditEvent;
import ci.cie.smartprepaid.audit.repo.AuditEventRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Point d'entrée unique pour journaliser un événement métier. Toute écriture
 * d'audit doit passer par ce service afin de garantir le masquage systématique
 * des tokens (test C05: "Token dans logs -> doit être masqué").
 */
@Service
public class AuditService {

    private final AuditEventRepository repository;

    // Détecte un champ "token":"...' ou "token=..." pour le masquer avant persistance/logs.
    private static final Pattern TOKEN_PATTERN =
            Pattern.compile("(?i)(\"?token\"?\\s*[:=]\\s*\")([^\"]+)(\")");

    public AuditService(AuditEventRepository repository) {
        this.repository = repository;
    }

    public AuditEvent record(String correlationId, String actor, String action, String entityType,
                              String entityId, String result, String errorCode, String details) {
        String maskedDetails = maskToken(details);
        AuditEvent event = new AuditEvent(correlationId, actor, action, entityType, entityId,
                result, errorCode, maskedDetails);
        return repository.save(event);
    }

    public List<AuditEvent> byCorrelationId(String correlationId) {
        return repository.findByCorrelationIdOrderByTimestampAsc(correlationId);
    }

    public List<AuditEvent> byEntity(String entityType, String entityId) {
        return repository.findByEntityTypeAndEntityIdOrderByTimestampAsc(entityType, entityId);
    }

    static String maskToken(String details) {
        if (details == null) return null;
        return TOKEN_PATTERN.matcher(details).replaceAll("$1***MASKED***$3");
    }
}
