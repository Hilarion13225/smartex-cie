package ci.cie.smartprepaid.device.api;

import ci.cie.smartprepaid.device.service.DeviceService;
import ci.cie.smartprepaid.meteradapter.MeterAdapterPort;
import ci.cie.smartprepaid.meteradapter.MeterCredit;
import ci.cie.smartprepaid.meteradapter.MeterStatus;
import ci.cie.smartprepaid.telemetry.domain.CreditAutonomyResult;
import ci.cie.smartprepaid.telemetry.service.CreditAutonomyService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** GET /api/v1/meters/{meterId}/status (voir API_CONTRACTS). */
@RestController
@RequestMapping("/api/v1/meters")
public class DeviceController {

    private final DeviceService deviceService;
    private final MeterAdapterPort meterAdapter;
    private final CreditAutonomyService creditAutonomyService;

    public DeviceController(DeviceService deviceService, MeterAdapterPort meterAdapter,
                             CreditAutonomyService creditAutonomyService) {
        this.deviceService = deviceService;
        this.meterAdapter = meterAdapter;
        this.creditAutonomyService = creditAutonomyService;
    }

    @GetMapping("/{meterId}/status")
    public Map<String, Object> status(@PathVariable String meterId) {
        var device = deviceService.findByMeterIdOrThrow(meterId);
        MeterStatus meterStatus = meterAdapter.readStatus(meterId);
        MeterCredit credit = meterAdapter.readCredit(meterId);
        CreditAutonomyResult autonomy = creditAutonomyService.evaluate(meterId, credit.creditBalance());

        // Map.of() rejette les valeurs null (lastSeen peut l'être avant le premier heartbeat) --
        // LinkedHashMap pour préserver l'ordre d'insertion sans ce piège.
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("meterId", meterId);
        response.put("deviceId", device.getDeviceId());
        response.put("deviceStatus", device.getStatus().name());
        response.put("lastSeen", device.getLastSeen() != null ? device.getLastSeen().toString() : null);
        response.put("onlineStatus", meterStatus.online());
        response.put("creditBalance", credit.creditBalance());
        response.put("creditUnit", credit.unit());
        // ALG-01 simplifié (voir CreditAutonomyService). Pas de creditPercent : dans un système
        // prépayé il n'y a pas de plafond naturel (contrairement à une batterie) -- voir
        // docs/05_reconciliation-api-frontend-backend.md pour le point ouvert avec le frontend.
        response.put("autonomyDays", autonomy.autonomyDays());
        response.put("creditStatus", autonomy.creditStatus().name());
        response.put("dataQuality", autonomy.dataQuality().name());
        return response;
    }
}
