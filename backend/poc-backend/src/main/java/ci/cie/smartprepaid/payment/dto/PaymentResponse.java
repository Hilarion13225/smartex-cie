package ci.cie.smartprepaid.payment.dto;

import ci.cie.smartprepaid.payment.domain.Payment;

import java.math.BigDecimal;
import java.util.UUID;

public record PaymentResponse(UUID paymentId, String meterId, String status, BigDecimal amountXof) {
    public static PaymentResponse from(Payment p) {
        return new PaymentResponse(p.getPaymentId(), p.getMeterId(), p.getStatus().name(), p.getAmountXof());
    }
}
