package ci.cie.smartprepaid.device.api;

import ci.cie.smartprepaid.device.repo.DeviceRepository;
import ci.cie.smartprepaid.device.service.DeviceService;
import ci.cie.smartprepaid.meteradapter.MeterAdapterPort;
import ci.cie.smartprepaid.meteradapter.MeterCredit;
import ci.cie.smartprepaid.meteradapter.MeterStatus;
import ci.cie.smartprepaid.telemetry.domain.ConsumptionBucket;
import ci.cie.smartprepaid.telemetry.domain.CreditAutonomyResult;
import ci.cie.smartprepaid.telemetry.service.ConsumptionHistoryService;
import ci.cie.smartprepaid.telemetry.service.CreditAutonomyService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** GET /api/v1/meters/{meterId}/status et /consumption, GET /api/v1/meters (liste, voir API_CONTRACTS). */
@RestController
@RequestMapping("/api/v1/meters")
public class DeviceController {

    private final DeviceService deviceService;
    private final DeviceRepository deviceRepository;
    private final MeterAdapterPort meterAdapter;
    private final CreditAutonomyService creditAutonomyService;
    private final ConsumptionHistoryService consumptionHistoryService;

    public DeviceController(DeviceService deviceService, DeviceRepository deviceRepository,
                             MeterAdapterPort meterAdapter, CreditAutonomyService creditAutonomyService,
                             ConsumptionHistoryService consumptionHistoryService) {
        this.deviceService = deviceService;
        this.deviceRepository = deviceRepository;
        this.meterAdapter = meterAdapter;
        this.creditAutonomyService = creditAutonomyService;
        this.consumptionHistoryService = consumptionHistoryService;
    }

    // Vue flotte (supervision CIE) : un seul meter existe dans ce PoC (V2__seed_lab_device.sql)
    // mais l'endpoint est écrit pour tenir si plusieurs devices sont provisionnés (voir T10).
    // Réservé aux rôles support : c'est une vue multi-clients, contrairement à /status qui reste
    // public. /api/v1/meters/** est permitAll au niveau URL (SecurityConfig) -- ce @PreAuthorize
    // s'applique quand même : le filtre JWT tourne sur toutes les requêtes (permitAll ne fait que
    // sauter la vérification au niveau URL, pas le filtre lui-même), et method security évalue
    // l'Authentication réelle qui en résulte (anonyme si aucun JWT -> 403 ici, comme voulu).
    @PreAuthorize("hasAnyRole('CIE_OPERATOR','CIE_ADMIN','DSI_ADMIN')")
    @GetMapping
    public List<Map<String, Object>> list() {
        return deviceRepository.findAll().stream().map(d -> status(d.getMeterId())).toList();
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

    /**
     * Historique de consommation par bucket (voir ConsumptionHistoryService). Les libellés
     * d'affichage (jour de semaine, nom de mois...) sont construits côté frontend à partir de
     * {@code bucketStart} -- pas un souci backend.
     */
    @GetMapping("/{meterId}/consumption")
    public List<ConsumptionBucket> consumption(@PathVariable String meterId,
                                                @RequestParam(defaultValue = "7") int bucketCount,
                                                @RequestParam(defaultValue = "24") long bucketHours) {
        return consumptionHistoryService.history(meterId, bucketCount, bucketHours);
    }
}
