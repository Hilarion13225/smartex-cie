package ci.cie.smartprepaid.customer.repo;

import ci.cie.smartprepaid.customer.domain.OtpChallenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OtpChallengeRepository extends JpaRepository<OtpChallenge, UUID> {
    Optional<OtpChallenge> findTopByPhoneNumberOrderByCreatedAtDesc(String phoneNumber);
}
