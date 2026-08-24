package ci.cie.smartprepaid.payment.api;

import ci.cie.smartprepaid.payment.dto.PaymentCallbackRequest;
import ci.cie.smartprepaid.payment.dto.PaymentResponse;
import ci.cie.smartprepaid.payment.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Reçoit le callback du Payment Simulator (T01). En production, cet endpoint
 * serait remplacé par le webhook signé du PSP Mobile Money (payment-adapter-service
 * dans l'architecture V2) — la validation de signature est un TODO explicite ici.
 */
@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/callback")
    public ResponseEntity<PaymentResponse> callback(@Valid @RequestBody PaymentCallbackRequest request) {
        var payment = paymentService.handleCallback(request);
        return ResponseEntity.accepted().body(PaymentResponse.from(payment));
    }
}
