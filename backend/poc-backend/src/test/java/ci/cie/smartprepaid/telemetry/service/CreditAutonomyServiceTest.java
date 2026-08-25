package ci.cie.smartprepaid.telemetry.service;

import ci.cie.smartprepaid.recharge.domain.Recharge;
import ci.cie.smartprepaid.recharge.domain.RechargeStatus;
import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Test purement unitaire (pas de contexte Spring, pas de DB réelle) du cœur
 * d'ALG-01 simplifié : reconstruction de la consommation nette (avec/sans
 * recharge dans l'intervalle) et bascule FALLBACK -> REAL.
 */
class CreditAutonomyServiceTest {

    private static final String METER_ID = "CIE-LAB-0001";

    private MeterReadingRepository meterReadingRepository;
    private RechargeRepository rechargeRepository;
    private TelemetryProperties properties;
    private CreditAutonomyService service;

    @BeforeEach
    void setUp() {
        meterReadingRepository = mock(MeterReadingRepository.class);
        rechargeRepository = mock(RechargeRepository.class);
        properties = new TelemetryProperties();
        service = new CreditAutonomyService(meterReadingRepository, rechargeRepository, properties);

        // Par défaut, aucune recharge dans un intervalle donné (surchargé explicitement par test).
        when(rechargeRepository.findByMeterIdAndStatusAndUpdatedAtBetween(anyString(), any(), any(), any()))
                .thenReturn(List.of());
    }

    @Test
    void consommationNette_sansRecharge_estCorrectementReconstruiteEtMoyennee() {
        Instant t0 = Instant.now().minus(2, ChronoUnit.DAYS);
        Instant t1 = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant t2 = Instant.now();
        List<MeterReading> readings = List.of(
                new MeterReading(METER_ID, new BigDecimal("10000"), t0),
                new MeterReading(METER_ID, new BigDecimal("9000"), t1),
                new MeterReading(METER_ID, new BigDecimal("8000"), t2)
        );
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(readings);

        CreditAutonomyResult result = service.evaluate(METER_ID, new BigDecimal("8000"));

        // 1000 FCFA/jour sur chacun des deux intervalles de 1 jour -> moyenne pondérée = 1000.
        assertThat(result.dataQuality()).isEqualTo(DataQuality.REAL);
        assertThat(result.dailyConsumptionFcfa()).isEqualByComparingTo("1000.00");
        assertThat(result.autonomyDays()).isEqualByComparingTo("8.0"); // 8000 / 1000
        assertThat(result.creditStatus()).isEqualTo(CreditStatus.NORMAL); // > 7 jours
    }

    @Test
    void consommationNette_excluBienLaRechargeDeLIntervalle_neLaConfondPasAvecUneBaisse() {
        // Sans exclusion de la recharge, un naïf delta(credit) verrait +4000 (credit monte) et
        // clamperait la "consommation" à 0 -- alors qu'une vraie consommation de 2000 a eu lieu,
        // simplement masquée par une recharge de 6000 dans le même intervalle. C'est exactement
        // le point que RechargeRepository#findByMeterIdAndStatusAndUpdatedAtBetween doit corriger.
        Instant t0 = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant t1 = Instant.now();
        List<MeterReading> readings = List.of(
                new MeterReading(METER_ID, new BigDecimal("5000"), t0),
                new MeterReading(METER_ID, new BigDecimal("9000"), t1) // credit monte malgré la consommation
        );
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(readings);

        Recharge recharge = new Recharge(UUID.randomUUID(), METER_ID, "CUST-1",
                new BigDecimal("6000"), "KEY-1", "corr-1");
        when(rechargeRepository.findByMeterIdAndStatusAndUpdatedAtBetween(
                METER_ID, RechargeStatus.CREDIT_APPLIED, t0, t1))
                .thenReturn(List.of(recharge));

        properties.setMinReadingsForReal(2); // 2 relevés suffisent ici pour ce test dédié

        CreditAutonomyResult result = service.evaluate(METER_ID, new BigDecimal("9000"));

        // (5000 + 6000 recharge) - 9000 observé = 2000 réellement consommé, pas 0.
        assertThat(result.dataQuality()).isEqualTo(DataQuality.REAL);
        assertThat(result.dailyConsumptionFcfa()).isEqualByComparingTo("2000.00");
        assertThat(result.autonomyDays()).isEqualByComparingTo("4.5"); // 9000 / 2000
        assertThat(result.creditStatus()).isEqualTo(CreditStatus.WARNING); // <= 7 et > 3 jours
    }

    @Test
    void historiqueInsuffisant_utiliseFallback_puisBasculeEnReelUneFoisAssezDeReleves() {
        // 1er appel : un seul relevé disponible (< minReadingsForReal par défaut = 3) -> FALLBACK.
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(List.of(new MeterReading(METER_ID, new BigDecimal("5000"), Instant.now())));

        CreditAutonomyResult fallbackResult = service.evaluate(METER_ID, new BigDecimal("5000"));

        assertThat(fallbackResult.dataQuality()).isEqualTo(DataQuality.FALLBACK);
        assertThat(fallbackResult.dailyConsumptionFcfa())
                .isEqualByComparingTo(properties.getFallbackDailyConsumptionFcfa());

        // 2e appel (même compteur, historique désormais suffisant) -> REAL.
        Instant t0 = Instant.now().minus(2, ChronoUnit.DAYS);
        Instant t1 = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant t2 = Instant.now();
        when(meterReadingRepository.findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(eq(METER_ID), any()))
                .thenReturn(List.of(
                        new MeterReading(METER_ID, new BigDecimal("7000"), t0),
                        new MeterReading(METER_ID, new BigDecimal("6500"), t1),
                        new MeterReading(METER_ID, new BigDecimal("6000"), t2)
                ));

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
