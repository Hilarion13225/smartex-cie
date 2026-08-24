package ci.cie.smartprepaid.device.api;

import ci.cie.smartprepaid.device.service.DeviceService;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reçoit le heartbeat périodique du dongle (§ALG-03 étape 1). Pour le PoC,
 * le mock-dongle appelle cet endpoint directement en HTTP plutôt qu'un topic
 * MQTT telemetry dédié, pour rester simple.
 */
@RestController
@RequestMapping("/api/v1/devices")
public class DeviceHeartbeatController {

    private final DeviceService deviceService;

    public DeviceHeartbeatController(DeviceService deviceService) {
        this.deviceService = deviceService;
    }

    @PostMapping("/{deviceId}/heartbeat")
    public void heartbeat(@PathVariable String deviceId) {
        deviceService.registerHeartbeat(deviceId);
    }
}
