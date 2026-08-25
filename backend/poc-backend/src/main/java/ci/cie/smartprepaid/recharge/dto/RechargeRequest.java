package ci.cie.smartprepaid.recharge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.UUID;

/** POST /api/v1/recharges (voir API_CONTRACTS). */
public record RechargeRequest(
        @NotBlank String customerId,
        @NotBlank String meterId,
        @NotNull @Positive BigDecimal amount,
        @NotBlank String channel,
        String paymentProvider,
        UUID paymentId, // optionnel: référence au paiement déjà confirmé qui justifie cette recharge
        @NotBlank String idempotencyKey,
        // Endpoint de recette pour T05 (token invalide -> REJECTED), cf. README §T05.
        // Absent/false en usage nominal: ne modifie jamais le flux de production.
        boolean forceInvalidToken
) {}
