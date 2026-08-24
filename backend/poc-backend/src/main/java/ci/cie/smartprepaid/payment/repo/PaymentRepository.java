package ci.cie.smartprepaid.payment.repo;

import ci.cie.smartprepaid.payment.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    Optional<Payment> findByProviderAndProviderTxId(String provider, String providerTxId);
}
