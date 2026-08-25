package ci.cie.smartprepaid.telemetry.service;

import ci.cie.smartprepaid.recharge.domain.Recharge;
import ci.cie.smartprepaid.recharge.domain.RechargeStatus;
import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
import ci.cie.smartprepaid.telemetry.domain.MeterReading;
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
 * Le cœur de la reconstruction consommation/recharge (voir Javadoc de la classe) : le
 * point le plus important à bien traiter, isolé ici de CreditAutonomyService.
 */
class NetConsumptionCalculatorTest {

    private static final String METER_ID = "CIE-LAB-0001";

    @Test
    void sansRecharge_consommationNetteEstSimplementLaBaisseDeCredit() {
        RechargeRepository rechargeRepository = mock(RechargeRepository.class);
        when(rechargeRepository.findByMeterIdAndStatusAndUpdatedAtBetween(anyString(), any(), any(), any()))
                .thenReturn(List.of());
        NetConsumptionCalculator calculator = new NetConsumptionCalculator(rechargeRepository);

        Instant t0 = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant t1 = Instant.now();
        MeterReading previous = new MeterReading(METER_ID, new BigDecimal("5000"), t0);
        MeterReading next = new MeterReading(METER_ID, new BigDecimal("4200"), t1);

        assertThat(calculator.between(METER_ID, previous, next)).isEqualTo(800.0);
    }

    @Test
    void avecRecharge_neConfondPasLaHausseDeCreditAvecUneBaisseDeConsommation() {
        // Sans exclusion, un delta naïf verrait +4000 (credit monte) -> 0 consommation.
        // Avec la recharge de 6000 correctement exclue : 2000 réellement consommés.
        RechargeRepository rechargeRepository = mock(RechargeRepository.class);
        Instant t0 = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant t1 = Instant.now();
        Recharge recharge = new Recharge(UUID.randomUUID(), METER_ID, "CUST-1",
                new BigDecimal("6000"), "KEY-1", "corr-1");
        when(rechargeRepository.findByMeterIdAndStatusAndUpdatedAtBetween(
                METER_ID, RechargeStatus.CREDIT_APPLIED, t0, t1))
                .thenReturn(List.of(recharge));
        NetConsumptionCalculator calculator = new NetConsumptionCalculator(rechargeRepository);

        MeterReading previous = new MeterReading(METER_ID, new BigDecimal("5000"), t0);
        MeterReading next = new MeterReading(METER_ID, new BigDecimal("9000"), t1);

        assertThat(calculator.between(METER_ID, previous, next)).isEqualTo(2000.0);
    }

    @Test
    void plusieursRechargesDansLIntervalle_sontToutesExclues() {
        RechargeRepository rechargeRepository = mock(RechargeRepository.class);
        Instant t0 = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant t1 = Instant.now();
        List<Recharge> recharges = List.of(
                new Recharge(UUID.randomUUID(), METER_ID, "CUST-1", new BigDecimal("2000"), "KEY-1", "corr-1"),
                new Recharge(UUID.randomUUID(), METER_ID, "CUST-1", new BigDecimal("3000"), "KEY-2", "corr-2")
        );
        when(rechargeRepository.findByMeterIdAndStatusAndUpdatedAtBetween(
                METER_ID, RechargeStatus.CREDIT_APPLIED, t0, t1))
                .thenReturn(recharges);
        NetConsumptionCalculator calculator = new NetConsumptionCalculator(rechargeRepository);

        MeterReading previous = new MeterReading(METER_ID, new BigDecimal("1000"), t0);
        MeterReading next = new MeterReading(METER_ID, new BigDecimal("5500"), t1);

        // (1000 + 2000 + 3000) - 5500 = 500 consommés.
        assertThat(calculator.between(METER_ID, previous, next)).isEqualTo(500.0);
    }

    @Test
    void resultatNegatif_estRameneAZero_jamaisComptéCommeUnGainNonTrace() {
        RechargeRepository rechargeRepository = mock(RechargeRepository.class);
        when(rechargeRepository.findByMeterIdAndStatusAndUpdatedAtBetween(anyString(), any(), any(), any()))
                .thenReturn(List.of());
        NetConsumptionCalculator calculator = new NetConsumptionCalculator(rechargeRepository);

        Instant t0 = Instant.now().minus(1, ChronoUnit.DAYS);
        Instant t1 = Instant.now();
        // Credit monte sans recharge capturée (bruit/anomalie) -> ne doit jamais donner un négatif.
        MeterReading previous = new MeterReading(METER_ID, new BigDecimal("5000"), t0);
        MeterReading next = new MeterReading(METER_ID, new BigDecimal("5200"), t1);

        assertThat(calculator.between(METER_ID, previous, next)).isEqualTo(0.0);
    }
}
