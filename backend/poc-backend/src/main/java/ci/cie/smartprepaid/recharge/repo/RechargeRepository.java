package ci.cie.smartprepaid.recharge.repo;

import ci.cie.smartprepaid.recharge.domain.Recharge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RechargeRepository extends JpaRepository<Recharge, UUID> {
    Optional<Recharge> findByIdempotencyKey(String idempotencyKey);
}
