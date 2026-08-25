package ci.cie.smartprepaid.recharge.dto;

import ci.cie.smartprepaid.recharge.domain.Recharge;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Élément de GET /api/v1/recharges?customerId=. {@code provider} peut être {@code null}
 * (recharge de recette créée sans Payment réel derrière, voir README T05/T06) -- jamais
 * inventé. Pas de champ token/tokenId : le token n'est jamais exposé en clair (RG-C-005).
 */
public record RechargeSummaryResponse(UUID rechargeId, UUID paymentId, String meterId, String customerId,
                                       String provider, BigDecimal amountXof, String status,
                                       String correlationId, Instant createdAt) {
    public static RechargeSummaryResponse from(Recharge r, String provider) {
        return new RechargeSummaryResponse(r.getRechargeId(), r.getPaymentId(), r.getMeterId(), r.getCustomerId(),
                provider, r.getAmountXof(), r.getStatus().name(), r.getCorrelationId(), r.getCreatedAt());
    }
}
