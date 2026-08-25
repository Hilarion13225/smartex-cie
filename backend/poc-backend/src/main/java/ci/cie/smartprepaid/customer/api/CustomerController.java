package ci.cie.smartprepaid.customer.api;

import ci.cie.smartprepaid.common.DomainException;
import ci.cie.smartprepaid.customer.domain.Customer;
import ci.cie.smartprepaid.customer.dto.CustomerResponse;
import ci.cie.smartprepaid.customer.repo.CustomerRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** GET /api/v1/customers/me — protégé par JWT (voir customer.security.SecurityConfig). */
@RestController
@RequestMapping("/api/v1/customers")
public class CustomerController {

    private final CustomerRepository customerRepository;

    public CustomerController(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    @GetMapping("/me")
    public CustomerResponse me(Authentication authentication) {
        UUID customerId = UUID.fromString(authentication.getName());
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new DomainException("NOT_FOUND", "Client introuvable: " + customerId));
        return CustomerResponse.from(customer);
    }
}
