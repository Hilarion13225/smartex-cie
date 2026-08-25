package ci.cie.smartprepaid.telemetry.service;

import ci.cie.smartprepaid.telemetry.TelemetryProperties;
import ci.cie.smartprepaid.telemetry.domain.ConsumptionBucket;
import ci.cie.smartprepaid.telemetry.domain.DataQuality;
import ci.cie.smartprepaid.telemetry.domain.MeterReading;
import ci.cie.smartprepaid.telemetry.repo.MeterReadingRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Historique de consommation par "bucket" de durée fixe (ex. 24 buckets d'1h, 7 buckets
 * d'1 jour) pour l'écran "Consommation" du frontend. Réutilise la même reconstruction
 * consommation/recharge que {@link CreditAutonomyService} ({@link NetConsumptionCalculator}),
 * appliquée aux relevés tombant dans chaque bucket plutôt qu'à toute la fenêtre glissante.
 *
 * <p>Un bucket est {@code REAL} s'il contient au moins deux relevés (donc au moins un
 * intervalle reconstruit exploitable) ; sinon la part de la consommation journalière de
 * secours correspondant à la durée du bucket est utilisée ({@code FALLBACK}) — même logique
 * de secours que CreditAutonomyService, jamais une valeur inventée sans le dire. La perte
 * possible aux limites de bucket (consommation entre le dernier relevé d'un bucket et le
 * premier du suivant) est une approximation acceptée pour un graphique, pas pour un calcul
 * financier exact.
 */
@Service
public class ConsumptionHistoryService {

    private final MeterReadingRepository meterReadingRepository;
    private final NetConsumptionCalculator netConsumptionCalculator;
    private final TelemetryProperties properties;

    public ConsumptionHistoryService(MeterReadingRepository meterReadingRepository,
                                      NetConsumptionCalculator netConsumptionCalculator,
                                      TelemetryProperties properties) {
        this.meterReadingRepository = meterReadingRepository;
        this.netConsumptionCalculator = netConsumptionCalculator;
        this.properties = properties;
    }

    public List<ConsumptionBucket> history(String meterId, int bucketCount, long bucketHours) {
        Instant now = Instant.now();
        Instant windowStart = now.minus(Duration.ofHours(bucketCount * bucketHours));
        List<MeterReading> readings =
                meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(meterId, windowStart);

        BigDecimal fallbackForBucket = properties.getFallbackDailyConsumptionFcfa()
                .multiply(BigDecimal.valueOf(bucketHours))
                .divide(BigDecimal.valueOf(24), 2, RoundingMode.HALF_UP);

        List<ConsumptionBucket> buckets = new ArrayList<>(bucketCount);
        for (int i = 0; i < bucketCount; i++) {
            Instant bucketStart = now.minus(Duration.ofHours((long) (bucketCount - i) * bucketHours));
            Instant bucketEnd = bucketStart.plus(Duration.ofHours(bucketHours));

            List<MeterReading> inBucket = readings.stream()
                    .filter(r -> !r.getCapturedAt().isBefore(bucketStart) && r.getCapturedAt().isBefore(bucketEnd))
                    .toList();

            if (inBucket.size() >= 2) {
                double total = 0;
                for (int j = 0; j < inBucket.size() - 1; j++) {
                    total += netConsumptionCalculator.between(meterId, inBucket.get(j), inBucket.get(j + 1));
                }
                buckets.add(new ConsumptionBucket(bucketStart, bucketEnd,
                        BigDecimal.valueOf(total).setScale(2, RoundingMode.HALF_UP), DataQuality.REAL));
            } else {
                buckets.add(new ConsumptionBucket(bucketStart, bucketEnd, fallbackForBucket, DataQuality.FALLBACK));
            }
        }
        return buckets;
    }
}
