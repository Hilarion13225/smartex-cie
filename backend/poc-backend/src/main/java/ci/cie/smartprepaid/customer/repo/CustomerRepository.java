package ci.cie.smartprepaid.customer.repo;

import ci.cie.smartprepaid.customer.domain.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    Optional<Customer> findByPhoneNumber(String phoneNumber);
}
