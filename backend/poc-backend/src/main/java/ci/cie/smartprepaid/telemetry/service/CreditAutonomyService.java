package ci.cie.smartprepaid.telemetry.service;

import ci.cie.smartprepaid.telemetry.TelemetryProperties;
import ci.cie.smartprepaid.telemetry.domain.CreditAutonomyResult;
import ci.cie.smartprepaid.telemetry.domain.CreditStatus;
import ci.cie.smartprepaid.telemetry.domain.DataQuality;
import ci.cie.smartprepaid.telemetry.domain.MeterReading;
import ci.cie.smartprepaid.telemetry.repo.MeterReadingRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * ALG-01 "Calcul autonomie crédit" — version volontairement simplifiée pour ce
 * PoC (voir docs/03_architecture-v2-classeur.md §04_Algorithmes pour la version
 * complète cible) : pas de pondération saisonnière, pas de profil par segment
 * client, pas de notification automatique. Ce service ne fait que le cœur du
 * calcul, avec de vraies données (MeterReading) plutôt que des valeurs inventées.
 *
 * <p><b>Reconstruction de la consommation nette (le point le plus délicat)</b> :
 * entre deux relevés consécutifs, le crédit peut baisser (consommation) ou
 * monter (recharge). Confondre les deux ferait paraître une recharge comme une
 * "consommation négative", ou pire, masquerait une consommation réelle derrière
 * une recharge simultanée. On calcule donc, pour chaque intervalle [r(i), r(i+1)] :
 * <pre>
 *   consommation_nette = (crédit(i) + Σ recharges CREDIT_APPLIED appliquées
 *                          dans l'intervalle) - crédit(i+1)
 * </pre>
 * c.-à-d. "ce que le crédit aurait dû valoir sans aucune consommation" moins la
 * valeur réellement observée. Les recharges sont identifiées via la table
 * `recharge` existante (statut CREDIT_APPLIED, horodatage = updatedAt de la
 * transition — voir Recharge#transitionTo), jamais inventées. Un résultat
 * négatif (relevé bruité, recharge non capturée dans la fenêtre, horloge...)
 * est ramené à 0 plutôt que compté comme un gain de crédit non tracé.
 *
 * <p><b>Moyenne</b> : pondérée par la durée de chaque intervalle (somme des
 * consommations / somme des durées), pas une moyenne naïve des taux par
 * intervalle — un intervalle de 3 jours ne doit pas peser autant qu'un
 * intervalle de 3 heures dans la moyenne.
 *
 * <p><b>Historique insuffisant</b> : si moins de {@code minReadingsForReal}
 * relevés existent sur la fenêtre, ou qu'aucun intervalle exploitable n'en
 * ressort, la consommation journalière de secours configurée est utilisée
 * ({@code dataQuality=FALLBACK}) — jamais une erreur, jamais une valeur
 * inventée sans le dire.
 */
@Service
public class CreditAutonomyService {

    /** Plafond d'affichage si la consommation mesurée est nulle (autonomie non bornée en pratique). */
    private static final BigDecimal MAX_AUTONOMY_DAYS = BigDecimal.valueOf(999);
    private static final BigDecimal NORMAL_THRESHOLD_DAYS = BigDecimal.valueOf(7);
    private static final BigDecimal WARNING_THRESHOLD_DAYS = BigDecimal.valueOf(3);
    private static final BigDecimal CRITICAL_THRESHOLD_DAYS = BigDecimal.valueOf(1);

    private final MeterReadingRepository meterReadingRepository;
    private final NetConsumptionCalculator netConsumptionCalculator;
    private final TelemetryProperties properties;

    public CreditAutonomyService(MeterReadingRepository meterReadingRepository,
                                  NetConsumptionCalculator netConsumptionCalculator, TelemetryProperties properties) {
        this.meterReadingRepository = meterReadingRepository;
        this.netConsumptionCalculator = netConsumptionCalculator;
        this.properties = properties;
    }

    public CreditAutonomyResult evaluate(String meterId, BigDecimal currentCreditBalance) {
        Instant since = Instant.now().minus(properties.getLookbackDays(), ChronoUnit.DAYS);
        List<MeterReading> readings =
                meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(meterId, since);

        double totalConsumptionFcfa = 0.0;
        double totalIntervalDays = 0.0;

        for (int i = 0; i < readings.size() - 1; i++) {
            MeterReading previous = readings.get(i);
            MeterReading next = readings.get(i + 1);

            double intervalDays = Duration.between(previous.getCapturedAt(), next.getCapturedAt()).toMillis()
                    / 86_400_000.0;
            if (intervalDays <= 0) {
                continue; // relevés au même instant ou hors-ordre -- garde-fou, ne devrait pas arriver
            }

            double netConsumption = netConsumptionCalculator.between(meterId, previous, next);

            totalConsumptionFcfa += netConsumption;
            totalIntervalDays += intervalDays;
        }

        boolean sufficientData = readings.size() >= properties.getMinReadingsForReal() && totalIntervalDays > 0;

        BigDecimal dailyConsumption;
        DataQuality dataQuality;
        if (sufficientData) {
            dailyConsumption = BigDecimal.valueOf(totalConsumptionFcfa / totalIntervalDays)
                    .setScale(2, RoundingMode.HALF_UP);
            dataQuality = DataQuality.REAL;
        } else {
            dailyConsumption = properties.getFallbackDailyConsumptionFcfa();
            dataQuality = DataQuality.FALLBACK;
        }

        BigDecimal autonomyDays = computeAutonomyDays(currentCreditBalance, dailyConsumption);
        CreditStatus creditStatus = classify(autonomyDays);

        return new CreditAutonomyResult(autonomyDays, creditStatus, dataQuality, dailyConsumption);
    }

    private static BigDecimal computeAutonomyDays(BigDecimal currentCreditBalance, BigDecimal dailyConsumption) {
        if (currentCreditBalance.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        if (dailyConsumption.compareTo(BigDecimal.ZERO) <= 0) {
            return MAX_AUTONOMY_DAYS;
        }
        BigDecimal autonomy = currentCreditBalance.divide(dailyConsumption, 4, RoundingMode.HALF_UP);
        return autonomy.min(MAX_AUTONOMY_DAYS).setScale(1, RoundingMode.HALF_UP);
    }

    private static CreditStatus classify(BigDecimal autonomyDays) {
        if (autonomyDays.compareTo(NORMAL_THRESHOLD_DAYS) > 0) return CreditStatus.NORMAL;
        if (autonomyDays.compareTo(WARNING_THRESHOLD_DAYS) > 0) return CreditStatus.WARNING;
        if (autonomyDays.compareTo(CRITICAL_THRESHOLD_DAYS) > 0) return CreditStatus.CRITICAL;
        return CreditStatus.IMMEDIATE;
    }
}
