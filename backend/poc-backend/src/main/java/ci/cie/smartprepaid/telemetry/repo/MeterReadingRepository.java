package ci.cie.smartprepaid.telemetry.repo;

import ci.cie.smartprepaid.telemetry.domain.MeterReading;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface MeterReadingRepository extends JpaRepository<MeterReading, UUID> {

    /** Historique exploitable par CreditAutonomyService (fenêtre glissante, voir TelemetryProperties). */
    List<MeterReading> findByMeterIdAndCapturedAtAfterOrderByCapturedAtAsc(String meterId, Instant capturedAtAfter);
}
