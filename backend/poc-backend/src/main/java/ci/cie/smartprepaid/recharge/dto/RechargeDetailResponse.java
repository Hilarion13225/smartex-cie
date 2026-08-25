package ci.cie.smartprepaid.recharge.dto;

import ci.cie.smartprepaid.recharge.domain.MeterCommand;
import ci.cie.smartprepaid.recharge.domain.Recharge;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Ne jamais ajouter le token en clair ni son hash ici (RG-C-005 / test C05) :
 * {@link Recharge} ne persiste de toute façon que {@code tokenHash}, jamais le
 * token lui-même — voir docs/05_reconciliation-api-frontend-backend.md §2.
 */
public record RechargeDetailResponse(UUID rechargeId, String finalStatus, String paymentStatus,
                                      String correlationId, String meterId, BigDecimal amountXof,
                                      Instant createdAt, Instant updatedAt, List<CommandSummary> commands) {

    public record CommandSummary(UUID commandId, String deviceId, String status, long sequence,
                                  int retryCount, Instant sentAt, Instant ackAt) {
        static CommandSummary from(MeterCommand c) {
            return new CommandSummary(c.getCommandId(), c.getDeviceId(), c.getStatus().name(),
                    c.getSequence(), c.getRetryCount(), c.getSentAt(), c.getAckAt());
        }
    }

    /**
     * @param paymentStatus statut du paiement lié (docs/03 API_CONTRACTS), ou {@code null}
     *                      si aucun paiement réel ne correspond (ex: recharge de recette
     *                      créée via l'endpoint manuel sans paymentId de paiement existant).
     */
    public static RechargeDetailResponse from(Recharge r, List<MeterCommand> commands, String paymentStatus) {
        return new RechargeDetailResponse(r.getRechargeId(), r.getStatus().name(), paymentStatus,
                r.getCorrelationId(), r.getMeterId(), r.getAmountXof(), r.getCreatedAt(), r.getUpdatedAt(),
                commands.stream().map(CommandSummary::from).toList());
    }
}
