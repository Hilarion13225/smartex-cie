package ci.cie.smartprepaid.telemetry.domain;

import java.math.BigDecimal;

/**
 * Sortie de CreditAutonomyService#evaluate. `dailyConsumptionFcfa` est exposé
 * pour audit/debug (traçabilité du calcul), pas nécessairement destiné au
 * frontend.
 */
public record CreditAutonomyResult(
        BigDecimal autonomyDays,
        CreditStatus creditStatus,
        DataQuality dataQuality,
        BigDecimal dailyConsumptionFcfa
) {}
