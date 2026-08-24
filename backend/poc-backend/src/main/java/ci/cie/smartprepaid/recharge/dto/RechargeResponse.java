package ci.cie.smartprepaid.recharge.dto;

import ci.cie.smartprepaid.recharge.domain.Recharge;

import java.math.BigDecimal;
import java.util.UUID;

public record RechargeResponse(UUID rechargeId, String status, String correlationId,
                                String meterId, BigDecimal amountXof) {
    public static RechargeResponse from(Recharge r) {
        return new RechargeResponse(r.getRechargeId(), r.getStatus().name(), r.getCorrelationId(),
                r.getMeterId(), r.getAmountXof());
    }
}
