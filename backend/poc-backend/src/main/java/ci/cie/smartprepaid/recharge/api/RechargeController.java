package ci.cie.smartprepaid.recharge.api;

import ci.cie.smartprepaid.payment.domain.Payment;
import ci.cie.smartprepaid.payment.repo.PaymentRepository;
import ci.cie.smartprepaid.recharge.domain.Recharge;
import ci.cie.smartprepaid.recharge.dto.RechargeDetailResponse;
import ci.cie.smartprepaid.recharge.dto.RechargeRequest;
import ci.cie.smartprepaid.recharge.dto.RechargeResponse;
import ci.cie.smartprepaid.recharge.dto.RechargeSummaryResponse;
import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
import ci.cie.smartprepaid.recharge.service.RechargeOrchestrator;
import jakarta.validation.Valid;
import org.slf4j.MDC;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import ci.cie.smartprepaid.common.CorrelationIdFilter;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class RechargeController {

    private final RechargeOrchestrator orchestrator;
    private final PaymentRepository paymentRepository;
    private final RechargeRepository rechargeRepository;

    public RechargeController(RechargeOrchestrator orchestrator, PaymentRepository paymentRepository,
                               RechargeRepository rechargeRepository) {
        this.orchestrator = orchestrator;
        this.paymentRepository = paymentRepository;
        this.rechargeRepository = rechargeRepository;
    }

    @PostMapping("/recharges")
    public ResponseEntity<RechargeResponse> create(@Valid @RequestBody RechargeRequest request) {
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        UUID paymentId = request.paymentId() != null ? request.paymentId() : UUID.randomUUID();
        var recharge = orchestrator.startManual(paymentId, request.meterId(), request.customerId(),
                request.amount(), request.idempotencyKey(), correlationId, request.forceInvalidToken());
        return ResponseEntity.accepted().body(RechargeResponse.from(recharge));
    }

    // Ownership : un CLIENT ne peut consulter que ses propres recharges ; les
    // rôles support (CIE_OPERATOR/CIE_ADMIN/DSI_ADMIN) peuvent tout consulter
    // (voir SecurityConfig pour la matrice complète et RechargeAuthorization
    // pour la logique réutilisable). Une recharge inexistante n'est pas bloquée
    // ici : c'est findRechargeOrThrow ci-dessous qui produit le 404 métier.
    @PreAuthorize("hasAnyRole('CIE_OPERATOR','CIE_ADMIN','DSI_ADMIN') "
            + "or @rechargeAuthorization.isOwner(#id, authentication)")
    @GetMapping("/recharges/{id}")
    public RechargeDetailResponse get(@PathVariable UUID id) {
        var recharge = orchestrator.findRechargeOrThrow(id);
        var commands = orchestrator.findCommandsForRecharge(id);
        // paymentId peut ne correspondre à aucun Payment réel pour une recharge de
        // recette créée via l'endpoint manuel sans paiement préalable (voir T05/T06
        // du README) : paymentStatus reste alors null plutôt que de lever une erreur.
        String paymentStatus = paymentRepository.findById(recharge.getPaymentId())
                .map(p -> p.getStatus().name())
                .orElse(null);
        return RechargeDetailResponse.from(recharge, commands, paymentStatus);
    }

    // Historique des transactions (écran "Transactions" frontend, ou supervision CIE fleet-
    // wide). customerId omis : uniquement pour les rôles support (fleet complète) -- un
    // CLIENT doit toujours préciser son propre customerId (ownership, même règle que GET
    // /recharges/{id}). customerId fourni et différent du sujet du JWT pour un CLIENT :
    // refusé, même logique que ci-dessus.
    @PreAuthorize("hasAnyRole('CIE_OPERATOR','CIE_ADMIN','DSI_ADMIN') "
            + "or (#customerId != null and #customerId == authentication.name)")
    @GetMapping("/recharges")
    public List<RechargeSummaryResponse> list(@RequestParam(required = false) String customerId) {
        List<Recharge> recharges = customerId != null
                ? rechargeRepository.findByCustomerIdOrderByCreatedAtDesc(customerId)
                : rechargeRepository.findAllByOrderByCreatedAtDesc();
        return recharges.stream().map(this::toSummary).toList();
    }

    private RechargeSummaryResponse toSummary(Recharge recharge) {
        String provider = paymentRepository.findById(recharge.getPaymentId())
                .map(Payment::getProvider)
                .orElse(null);
        return RechargeSummaryResponse.from(recharge, provider);
    }

    @PostMapping("/commands/{id}/retry")
    public ResponseEntity<Map<String, Object>> retry(@PathVariable UUID id,
                                                       @RequestParam(defaultValue = "support") String operatorId) {
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        var command = orchestrator.retryCommand(id, operatorId, correlationId);
        return ResponseEntity.ok(Map.of(
                "commandId", command.getCommandId(),
                "retryStatus", "RETRY_SENT",
                "retryCount", command.getRetryCount()
        ));
    }
}
