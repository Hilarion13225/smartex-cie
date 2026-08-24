package ci.cie.smartprepaid.recharge.repo;

import ci.cie.smartprepaid.recharge.domain.MeterCommand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CommandRepository extends JpaRepository<MeterCommand, UUID> {
    List<MeterCommand> findByRechargeIdOrderBySequenceAsc(UUID rechargeId);
    Optional<MeterCommand> findTopByDeviceIdOrderBySequenceDesc(String deviceId);
    Optional<MeterCommand> findByRechargeIdAndStatusIn(UUID rechargeId, List<ci.cie.smartprepaid.recharge.domain.CommandStatus> statuses);
}
