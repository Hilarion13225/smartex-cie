package ci.cie.smartprepaid.device.api;

import ci.cie.smartprepaid.device.service.DeviceService;
import ci.cie.smartprepaid.meteradapter.MeterAdapterPort;
import ci.cie.smartprepaid.meteradapter.MeterCredit;
import ci.cie.smartprepaid.meteradapter.MeterStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** GET /api/v1/meters/{meterId}/status (voir API_CONTRACTS). */
@RestController
@RequestMapping("/api/v1/meters")
public class DeviceController {

    private final DeviceService deviceService;
    private final MeterAdapterPort meterAdapter;

    public DeviceController(DeviceService deviceService, MeterAdapterPort meterAdapter) {
        this.deviceService = deviceService;
        this.meterAdapter = meterAdapter;
    }

    @GetMapping("/{meterId}/status")
    public Map<String, Object> status(@PathVariable String meterId) {
        var device = deviceService.findByMeterIdOrThrow(meterId);
        MeterStatus meterStatus = meterAdapter.readStatus(meterId);
        MeterCredit credit = meterAdapter.readCredit(meterId);
        return Map.of(
                "meterId", meterId,
                "deviceId", device.getDeviceId(),
                "deviceStatus", device.getStatus().name(),
                "lastSeen", device.getLastSeen() != null ? device.getLastSeen().toString() : null,
                "onlineStatus", meterStatus.online(),
                "creditBalance", credit.creditBalance(),
                "creditUnit", credit.unit()
        );
    }
}
