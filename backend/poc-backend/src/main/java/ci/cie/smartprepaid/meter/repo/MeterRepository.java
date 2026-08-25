package ci.cie.smartprepaid.meter.repo;

import ci.cie.smartprepaid.meter.domain.Meter;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MeterRepository extends JpaRepository<Meter, String> {
}
