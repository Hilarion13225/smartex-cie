package ci.cie.smartprepaid.device.service;

import ci.cie.smartprepaid.common.DomainException;
import ci.cie.smartprepaid.device.domain.Device;
import ci.cie.smartprepaid.device.repo.DeviceRepository;
import org.springframework.stereotype.Service;

@Service
public class DeviceService {

    private final DeviceRepository repository;

    public DeviceService(DeviceRepository repository) {
        this.repository = repository;
    }

    public Device findByMeterIdOrThrow(String meterId) {
        return repository.findByMeterId(meterId)
                .orElseThrow(() -> new DomainException("NOT_FOUND", "Aucun device associé au meterId " + meterId));
    }

    public Device registerHeartbeat(String deviceId) {
        Device device = repository.findById(deviceId)
                .orElseThrow(() -> new DomainException("NOT_FOUND", "Device inconnu: " + deviceId));
        device.heartbeat();
        return repository.save(device);
    }

    public Device upsert(Device device) {
        return repository.save(device);
    }
}
