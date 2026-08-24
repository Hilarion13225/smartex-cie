package ci.cie.smartprepaid.recharge.dto;

import ci.cie.smartprepaid.recharge.domain.MeterCommand;
import ci.cie.smartprepaid.recharge.domain.Recharge;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RechargeDetailResponse(UUID rechargeId, String finalStatus, String correlationId,
                                      String meterId, BigDecimal amountXof, Instant createdAt,
                                      Instant updatedAt, List<CommandSummary> commands) {

    public record CommandSummary(UUID commandId, String deviceId, String status, long sequence,
                                  int retryCount, Instant sentAt, Instant ackAt) {
        static CommandSummary from(MeterCommand c) {
            return new CommandSummary(c.getCommandId(), c.getDeviceId(), c.getStatus().name(),
                    c.getSequence(), c.getRetryCount(), c.getSentAt(), c.getAckAt());
        }
    }

    public static RechargeDetailResponse from(Recharge r, List<MeterCommand> commands) {
        return new RechargeDetailResponse(r.getRechargeId(), r.getStatus().name(), r.getCorrelationId(),
                r.getMeterId(), r.getAmountXof(), r.getCreatedAt(), r.getUpdatedAt(),
                commands.stream().map(CommandSummary::from).toList());
    }
}
