package ci.cie.smartprepaid.recharge.repo;

import ci.cie.smartprepaid.recharge.domain.CommandStatus;
import ci.cie.smartprepaid.recharge.domain.MeterCommand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CommandRepository extends JpaRepository<MeterCommand, UUID> {
    List<MeterCommand> findByRechargeIdOrderBySequenceAsc(UUID rechargeId);
    Optional<MeterCommand> findTopByDeviceIdOrderBySequenceDesc(String deviceId);
    Optional<MeterCommand> findByRechargeIdAndStatusIn(UUID rechargeId, List<CommandStatus> statuses);

    /** T07: commandes non terminales (PENDING/SENT) dont la fenêtre de validité est dépassée. */
    List<MeterCommand> findByStatusInAndExpiresAtBefore(List<CommandStatus> statuses, Instant expiresAtBefore);
}
