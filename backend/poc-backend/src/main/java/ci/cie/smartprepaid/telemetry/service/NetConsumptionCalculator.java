package ci.cie.smartprepaid.telemetry.service;

import ci.cie.smartprepaid.recharge.domain.Recharge;
import ci.cie.smartprepaid.recharge.domain.RechargeStatus;
import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
import ci.cie.smartprepaid.telemetry.domain.MeterReading;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Cœur de la reconstruction "consommation nette entre deux relevés" (voir Javadoc de
 * {@link CreditAutonomyService} pour le détail de l'approche) — extrait ici pour être
 * réutilisé tel quel par {@link CreditAutonomyService} (moyenne glissante) et
 * {@link ConsumptionHistoryService} (historique par période), plutôt que dupliqué.
 */
@Component
public class NetConsumptionCalculator {

    private final RechargeRepository rechargeRepository;

    public NetConsumptionCalculator(RechargeRepository rechargeRepository) {
        this.rechargeRepository = rechargeRepository;
    }

    /** FCFA réellement consommés entre {@code previous} et {@code next}, jamais négatif. */
    public double between(String meterId, MeterReading previous, MeterReading next) {
        BigDecimal rechargedInInterval = rechargeRepository
                .findByMeterIdAndStatusAndUpdatedAtBetween(meterId, RechargeStatus.CREDIT_APPLIED,
                        previous.getCapturedAt(), next.getCapturedAt())
                .stream()
                .map(Recharge::getAmountXof)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        double expectedWithoutConsumption = previous.getCreditBalance().doubleValue()
                + rechargedInInterval.doubleValue();
        double netConsumption = expectedWithoutConsumption - next.getCreditBalance().doubleValue();
        // Un résultat négatif (relevé bruité, recharge non capturée...) n'est jamais compté
        // comme un gain de crédit non tracé -- voir Javadoc de CreditAutonomyService.
        return Math.max(netConsumption, 0);
    }
}
