package ci.cie.smartprepaid.recharge.api;

import ci.cie.smartprepaid.recharge.dto.RechargeDetailResponse;
import ci.cie.smartprepaid.recharge.dto.RechargeRequest;
import ci.cie.smartprepaid.recharge.dto.RechargeResponse;
import ci.cie.smartprepaid.recharge.service.RechargeOrchestrator;
import jakarta.validation.Valid;
import org.slf4j.MDC;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import ci.cie.smartprepaid.common.CorrelationIdFilter;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class RechargeController {

    private final RechargeOrchestrator orchestrator;

    public RechargeController(RechargeOrchestrator orchestrator) {
        this.orchestrator = orchestrator;
    }

    @PostMapping("/recharges")
    public ResponseEntity<RechargeResponse> create(@Valid @RequestBody RechargeRequest request) {
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        UUID paymentId = request.paymentId() != null ? request.paymentId() : UUID.randomUUID();
        var recharge = orchestrator.startManual(paymentId, request.meterId(), request.customerId(),
                request.amount(), request.idempotencyKey(), correlationId);
        return ResponseEntity.accepted().body(RechargeResponse.from(recharge));
    }

    @GetMapping("/recharges/{id}")
    public RechargeDetailResponse get(@PathVariable UUID id) {
        var recharge = orchestrator.findRechargeOrThrow(id);
        var commands = orchestrator.findCommandsForRecharge(id);
        return RechargeDetailResponse.from(recharge, commands);
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
