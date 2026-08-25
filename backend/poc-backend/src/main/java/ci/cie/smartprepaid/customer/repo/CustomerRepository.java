package ci.cie.smartprepaid.customer.repo;

import ci.cie.smartprepaid.customer.domain.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    Optional<Customer> findByPhoneNumber(String phoneNumber);

    /** Vérifie qu'un compteur n'est pas déjà lié à un autre client (voir AuthService.register) --
     * contrôle explicite avant écriture pour renvoyer une erreur métier claire plutôt que de
     * laisser la contrainte UNIQUE (uk_customer_meter_id) échouer en SQL brut. */
    Optional<Customer> findByMeterId(String meterId);
}
