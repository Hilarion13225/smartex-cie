package ci.cie.smartprepaid.recharge.repo;

import ci.cie.smartprepaid.recharge.domain.Recharge;
import ci.cie.smartprepaid.recharge.domain.RechargeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RechargeRepository extends JpaRepository<Recharge, UUID> {
    Optional<Recharge> findByIdempotencyKey(String idempotencyKey);

    /** UPDATE conditionnel atomique -- voir CommandRepository#markSentIfStatus pour la
     * justification (même classe de "lost update" possible entre CommandSendFinalizer et un
     * ACK concurrent très rapide). */
    @Modifying
    @Query("UPDATE Recharge r SET r.status = :newStatus, r.updatedAt = :updatedAt "
            + "WHERE r.rechargeId = :id AND r.status = :expectedStatus")
    int markStatusIfStatus(@Param("id") UUID rechargeId, @Param("expectedStatus") RechargeStatus expectedStatus,
                            @Param("newStatus") RechargeStatus newStatus, @Param("updatedAt") Instant updatedAt);
}
