package ci.cie.smartprepaid.payment.service;

import ci.cie.smartprepaid.audit.service.AuditService;
import ci.cie.smartprepaid.payment.domain.Payment;
import ci.cie.smartprepaid.payment.domain.PaymentStatus;
import ci.cie.smartprepaid.payment.dto.PaymentCallbackRequest;
import ci.cie.smartprepaid.payment.repo.PaymentRepository;
import ci.cie.smartprepaid.recharge.service.RechargeOrchestrator;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ci.cie.smartprepaid.common.CorrelationIdFilter;

@Service
public class PaymentService {

    private final PaymentRepository repository;
    private final AuditService auditService;
    private final RechargeOrchestrator rechargeOrchestrator;

    public PaymentService(PaymentRepository repository, AuditService auditService,
                           RechargeOrchestrator rechargeOrchestrator) {
        this.repository = repository;
        this.auditService = auditService;
        this.rechargeOrchestrator = rechargeOrchestrator;
    }

    /**
     * T01 (paiement nominal) + anti-double-paiement (contrainte unique provider/providerTxId).
     * Déclenche ALG-02 (recharge automatique) si le paiement est confirmé.
     */
    @Transactional
    public Payment handleCallback(PaymentCallbackRequest request) {
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);

        return repository.findByProviderAndProviderTxId(request.provider(), request.providerTxId())
                .map(existing -> {
                    auditService.record(correlationId, "payment-service", "PAYMENT_DUPLICATE_IGNORED",
                            "PAYMENT", existing.getPaymentId().toString(), "IGNORED", null,
                            "Callback déjà traité pour provider=%s providerTxId=%s".formatted(
                                    request.provider(), request.providerTxId()));
                    return existing;
                })
                .orElseGet(() -> createAndOrchestrate(request, correlationId));
    }

    private Payment createAndOrchestrate(PaymentCallbackRequest request, String correlationId) {
        PaymentStatus status = "SUCCESS".equalsIgnoreCase(request.status())
                ? PaymentStatus.CONFIRMED : PaymentStatus.FAILED;

        Payment payment = new Payment(request.meterId(), request.customerId(), request.provider(),
                request.providerTxId(), request.amountXof(), status);
        payment = repository.save(payment);

        auditService.record(correlationId, "payment-service", "PAYMENT_" + status, "PAYMENT",
                payment.getPaymentId().toString(), status.name(), null,
                "meterId=%s amount=%s".formatted(request.meterId(), request.amountXof()));

        if (status == PaymentStatus.CONFIRMED) {
            rechargeOrchestrator.startFromConfirmedPayment(payment, correlationId);
        }
        return payment;
    }
}
