package ci.cie.smartprepaid.device.repo;

import ci.cie.smartprepaid.device.domain.Device;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DeviceRepository extends JpaRepository<Device, String> {
    Optional<Device> findByMeterId(String meterId);
}
