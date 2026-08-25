package ci.cie.smartprepaid.device.api;

import ci.cie.smartprepaid.device.dto.DeviceSummaryResponse;
import ci.cie.smartprepaid.device.repo.DeviceRepository;
import ci.cie.smartprepaid.device.service.DeviceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * POST /{deviceId}/heartbeat : reçoit le heartbeat périodique du dongle (§ALG-03 étape 1,
 * public — voir SecurityConfig). Pour le PoC, le mock-dongle appelle cet endpoint
 * directement en HTTP plutôt qu'un topic MQTT telemetry dédié, pour rester simple.
 *
 * GET (liste) : fleet des devices, réservé CIE_OPERATOR/CIE_ADMIN/DSI_ADMIN (voir
 * SecurityConfig — placé avant la règle permitAll /api/v1/devices/** pour ce chemin exact).
 */
@RestController
@RequestMapping("/api/v1/devices")
public class DeviceHeartbeatController {

    private final DeviceService deviceService;
    private final DeviceRepository deviceRepository;

    public DeviceHeartbeatController(DeviceService deviceService, DeviceRepository deviceRepository) {
        this.deviceService = deviceService;
        this.deviceRepository = deviceRepository;
    }

    @PostMapping("/{deviceId}/heartbeat")
    public void heartbeat(@PathVariable String deviceId) {
        deviceService.registerHeartbeat(deviceId);
    }

    @GetMapping
    public List<DeviceSummaryResponse> list() {
        return deviceRepository.findAll().stream().map(DeviceSummaryResponse::from).toList();
    }
}
