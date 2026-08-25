package ci.cie.smartprepaid.telemetry.service;

import ci.cie.smartprepaid.telemetry.TelemetryProperties;
import ci.cie.smartprepaid.telemetry.domain.ConsumptionBucket;
import ci.cie.smartprepaid.telemetry.domain.DataQuality;
import ci.cie.smartprepaid.telemetry.domain.MeterReading;
import ci.cie.smartprepaid.telemetry.repo.MeterReadingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConsumptionHistoryServiceTest {

    private static final String METER_ID = "CIE-LAB-0001";

    private MeterReadingRepository meterReadingRepository;
    private NetConsumptionCalculator netConsumptionCalculator;
    private TelemetryProperties properties;
    private ConsumptionHistoryService service;

    @BeforeEach
    void setUp() {
        meterReadingRepository = mock(MeterReadingRepository.class);
        netConsumptionCalculator = mock(NetConsumptionCalculator.class);
        properties = new TelemetryProperties();
        properties.setFallbackDailyConsumptionFcfa(new BigDecimal("480"));
        service = new ConsumptionHistoryService(meterReadingRepository, netConsumptionCalculator, properties);
    }

    @Test
    void bucketAvecAuMoinsDeuxReleves_estReelEtSommeLesIntervalles() {
        Instant now = Instant.now();
        // 2 buckets de 24h : le plus récent doit contenir ces deux relevés d'aujourd'hui.
        MeterReading r0 = new MeterReading(METER_ID, new BigDecimal("5000"), now.minus(2, ChronoUnit.HOURS));
        MeterReading r1 = new MeterReading(METER_ID, new BigDecimal("4700"), now.minus(1, ChronoUnit.HOURS));
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(List.of(r0, r1));
        when(netConsumptionCalculator.between(METER_ID, r0, r1)).thenReturn(300.0);

        List<ConsumptionBucket> buckets = service.history(METER_ID, 2, 24);

        ConsumptionBucket lastBucket = buckets.get(1);
        assertThat(lastBucket.dataQuality()).isEqualTo(DataQuality.REAL);
        assertThat(lastBucket.consumptionFcfa()).isEqualByComparingTo("300.00");
    }

    @Test
    void bucketSansAssezDeReleves_utiliseLaPartDeFallbackProportionnelleALaDuree() {
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(List.of());

        List<ConsumptionBucket> buckets = service.history(METER_ID, 3, 12); // buckets de 12h

        // fallback journalier 480 -> 480 * 12/24 = 240 par bucket de 12h.
        assertThat(buckets).hasSize(3);
        for (ConsumptionBucket bucket : buckets) {
            assertThat(bucket.dataQuality()).isEqualTo(DataQuality.FALLBACK);
            assertThat(bucket.consumptionFcfa()).isEqualByComparingTo("240.00");
        }
    }

    @Test
    void lesBucketsCouvrentDesFenetresConsecutivesEtCroissantesJusquAMaintenant() {
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(List.of());

        List<ConsumptionBucket> buckets = service.history(METER_ID, 4, 6); // 4 buckets de 6h = 24h

        for (int i = 0; i < buckets.size() - 1; i++) {
            assertThat(buckets.get(i).bucketEnd()).isEqualTo(buckets.get(i + 1).bucketStart());
        }
        assertThat(buckets.get(buckets.size() - 1).bucketEnd()).isAfterOrEqualTo(Instant.now().minusSeconds(2));
    }
}
