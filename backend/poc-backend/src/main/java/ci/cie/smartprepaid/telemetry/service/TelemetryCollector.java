package ci.cie.smartprepaid.telemetry.service;

import ci.cie.smartprepaid.device.domain.Device;
import ci.cie.smartprepaid.device.repo.DeviceRepository;
import ci.cie.smartprepaid.meteradapter.MeterAdapterPort;
import ci.cie.smartprepaid.meteradapter.MeterCredit;
import ci.cie.smartprepaid.telemetry.TelemetryProperties;
import ci.cie.smartprepaid.telemetry.domain.MeterReading;
import ci.cie.smartprepaid.telemetry.repo.MeterReadingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Interroge périodiquement meterAdapter.readCredit() pour chaque device connu et
 * enregistre un relevé (voir MeterReading) — alimente CreditAutonomyService
 * (ALG-01 simplifié). Même pattern que CommandExpiryWatcher : un échec sur un
 * device (dongle injoignable) n'interrompt pas la collecte des autres.
 */
@Component
public class TelemetryCollector {

    private static final Logger log = LoggerFactory.getLogger(TelemetryCollector.class);

    private final DeviceRepository deviceRepository;
    private final MeterAdapterPort meterAdapter;
    private final MeterReadingRepository meterReadingRepository;

    public TelemetryCollector(DeviceRepository deviceRepository, MeterAdapterPort meterAdapter,
                               MeterReadingRepository meterReadingRepository) {
        this.deviceRepository = deviceRepository;
        this.meterAdapter = meterAdapter;
        this.meterReadingRepository = meterReadingRepository;
    }

    @Scheduled(fixedRateString = "${telemetry.collection-interval-seconds:300}000",
            initialDelayString = "${telemetry.collection-interval-seconds:300}000")
    public void collectReadings() {
        List<Device> devices = deviceRepository.findAll();
        for (Device device : devices) {
            try {
                MeterCredit credit = meterAdapter.readCredit(device.getMeterId());
                meterReadingRepository.save(new MeterReading(device.getMeterId(), credit.creditBalance(), Instant.now()));
            } catch (Exception e) {
                log.warn("Relevé de télémétrie impossible pour meterId={}: {}", device.getMeterId(), e.getMessage());
            }
        }
    }
}
