package ci.cie.smartprepaid.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Callback reçu du Payment Simulator (ou, plus tard, d'un vrai PSP Mobile Money).
 * T01 (Paiement nominal) et ALG-02 étape 1-2.
 */
public record PaymentCallbackRequest(
        @NotBlank String meterId,
        @NotBlank String customerId,
        @NotBlank String provider,
        @NotBlank String providerTxId,
        @NotNull @Positive BigDecimal amountXof,
        @NotBlank String status // SUCCESS | FAILED, tel qu'émis par le Payment Simulator
) {}
