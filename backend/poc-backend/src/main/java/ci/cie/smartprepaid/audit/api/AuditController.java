package ci.cie.smartprepaid.audit.api;

import ci.cie.smartprepaid.audit.domain.AuditEvent;
import ci.cie.smartprepaid.audit.service.AuditService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Support / recette: reconstruit la chaîne complète paiement -> token -> commande
 * -> ACK -> statut final à partir d'un correlationId (T15 Auditabilité, RG-S-002).
 */
@RestController
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping("/api/v1/audit")
    public List<AuditEvent> byCorrelationId(@RequestParam String correlationId) {
        return auditService.byCorrelationId(correlationId);
    }

    @GetMapping("/api/v1/support/timeline")
    public List<AuditEvent> timeline(@RequestParam String entityType, @RequestParam String entityId) {
        return auditService.byEntity(entityType, entityId);
    }
}
