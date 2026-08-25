package ci.cie.smartprepaid.telemetry.service;

import ci.cie.smartprepaid.telemetry.TelemetryProperties;
import ci.cie.smartprepaid.telemetry.domain.CreditAutonomyResult;
import ci.cie.smartprepaid.telemetry.domain.CreditStatus;
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

/**
 * Test purement unitaire (pas de contexte Spring, pas de DB réelle) de la moyenne
 * glissante / bascule FALLBACK-REAL / classification. La reconstruction consommation-
 * recharge elle-même est testée séparément dans NetConsumptionCalculatorTest --
 * NetConsumptionCalculator est mocké ici pour isoler ce qui est propre à ce service.
 */
class CreditAutonomyServiceTest {

    private static final String METER_ID = "CIE-LAB-0001";

    private MeterReadingRepository meterReadingRepository;
    private NetConsumptionCalculator netConsumptionCalculator;
    private TelemetryProperties properties;
    private CreditAutonomyService service;

    @BeforeEach
    void setUp() {
        meterReadingRepository = mock(MeterReadingRepository.class);
        netConsumptionCalculator = mock(NetConsumptionCalculator.class);
        properties = new TelemetryProperties();
        service = new CreditAutonomyService(meterReadingRepository, netConsumptionCalculator, properties);
    }

    @Test
    void moyennePondereeParLaDureeDeChaqueIntervalle() {
        Instant t0 = Instant.now().minus(2, ChronoUnit.DAYS);
        Instant t1 = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant t2 = Instant.now();
        MeterReading r0 = new MeterReading(METER_ID, new BigDecimal("10000"), t0);
        MeterReading r1 = new MeterReading(METER_ID, new BigDecimal("9000"), t1);
        MeterReading r2 = new MeterReading(METER_ID, new BigDecimal("8000"), t2);
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(List.of(r0, r1, r2));
        when(netConsumptionCalculator.between(METER_ID, r0, r1)).thenReturn(1000.0);
        when(netConsumptionCalculator.between(METER_ID, r1, r2)).thenReturn(1000.0);

        CreditAutonomyResult result = service.evaluate(METER_ID, new BigDecimal("8000"));

        assertThat(result.dataQuality()).isEqualTo(DataQuality.REAL);
        assertThat(result.dailyConsumptionFcfa()).isEqualByComparingTo("1000.00");
        assertThat(result.autonomyDays()).isEqualByComparingTo("8.0"); // 8000 / 1000
        assertThat(result.creditStatus()).isEqualTo(CreditStatus.NORMAL); // > 7 jours
    }

    @Test
    void intervallesADureesInegales_pesentProportionnellementDansLaMoyenne() {
        // Intervalle 1 : 1 jour, 1000 FCFA -> 1000/j. Intervalle 2 : 3 jours, 300 FCFA -> 100/j.
        // Moyenne naïve des taux = 550/j ; moyenne pondérée par la durée = (1000+300)/4 = 325/j.
        Instant t0 = Instant.now().minus(4, ChronoUnit.DAYS);
        Instant t1 = Instant.now().minus(3, ChronoUnit.DAYS);
        Instant t2 = Instant.now();
        MeterReading r0 = new MeterReading(METER_ID, new BigDecimal("5000"), t0);
        MeterReading r1 = new MeterReading(METER_ID, new BigDecimal("4000"), t1);
        MeterReading r2 = new MeterReading(METER_ID, new BigDecimal("3700"), t2);
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(List.of(r0, r1, r2));
        when(netConsumptionCalculator.between(METER_ID, r0, r1)).thenReturn(1000.0);
        when(netConsumptionCalculator.between(METER_ID, r1, r2)).thenReturn(300.0);

        CreditAutonomyResult result = service.evaluate(METER_ID, new BigDecimal("3700"));

        assertThat(result.dailyConsumptionFcfa()).isEqualByComparingTo("325.00");
    }

    @Test
    void historiqueInsuffisant_utiliseFallback_puisBasculeEnReelUneFoisAssezDeReleves() {
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(List.of(new MeterReading(METER_ID, new BigDecimal("5000"), Instant.now())));

        CreditAutonomyResult fallbackResult = service.evaluate(METER_ID, new BigDecimal("5000"));

        assertThat(fallbackResult.dataQuality()).isEqualTo(DataQuality.FALLBACK);
        assertThat(fallbackResult.dailyConsumptionFcfa())
                .isEqualByComparingTo(properties.getFallbackDailyConsumptionFcfa());

        Instant t0 = Instant.now().minus(2, ChronoUnit.DAYS);
        Instant t1 = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant t2 = Instant.now();
        MeterReading r0 = new MeterReading(METER_ID, new BigDecimal("7000"), t0);
        MeterReading r1 = new MeterReading(METER_ID, new BigDecimal("6500"), t1);
        MeterReading r2 = new MeterReading(METER_ID, new BigDecimal("6000"), t2);
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(List.of(r0, r1, r2));
        when(netConsumptionCalculator.between(METER_ID, r0, r1)).thenReturn(500.0);
        when(netConsumptionCalculator.between(METER_ID, r1, r2)).thenReturn(500.0);

        CreditAutonomyResult realResult = service.evaluate(METER_ID, new BigDecimal("6000"));

        assertThat(realResult.dataQuality()).isEqualTo(DataQuality.REAL);
        assertThat(realResult.dailyConsumptionFcfa()).isEqualByComparingTo("500.00");
    }

    @Test
    void creditNulOuNegatif_autonomieZeroEtStatutImmediate() {
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(List.of());

        CreditAutonomyResult result = service.evaluate(METER_ID, BigDecimal.ZERO);

        assertThat(result.autonomyDays()).isEqualByComparingTo("0");
        assertThat(result.creditStatus()).isEqualTo(CreditStatus.IMMEDIATE);
    }
}
