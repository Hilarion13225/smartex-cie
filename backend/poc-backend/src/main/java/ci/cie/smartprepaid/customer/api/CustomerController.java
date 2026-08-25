package ci.cie.smartprepaid.customer.api;

import ci.cie.smartprepaid.common.DomainException;
import ci.cie.smartprepaid.customer.domain.Customer;
import ci.cie.smartprepaid.customer.domain.CustomerRole;
import ci.cie.smartprepaid.customer.dto.AssignMeterRequest;
import ci.cie.smartprepaid.customer.dto.ChangeRoleRequest;
import ci.cie.smartprepaid.customer.dto.CreateCustomerRequest;
import ci.cie.smartprepaid.customer.dto.CustomerResponse;
import ci.cie.smartprepaid.customer.repo.CustomerRepository;
import ci.cie.smartprepaid.meter.repo.MeterRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Domaine customer/auth. GET /me — protégé par JWT, self uniquement. Tout le reste
 * (liste, détail, création directe, changement de rôle, suspension, association
 * compteur) est le module de gestion admin, réservé CIE_ADMIN/DSI_ADMIN (même matrice
 * que "Gérer utilisateurs & rôles" côté frontend, voir AdminUsers.tsx) -- chemins sous
 * /api/v1/customers/** non couverts par la règle URL exacte de SecurityConfig
 * (/api/v1/customers, sans /**), d'où un @PreAuthorize explicite sur chaque méthode
 * plutôt que de compter sur cette règle pour les nouveaux sous-chemins.
 */
@RestController
@RequestMapping("/api/v1/customers")
public class CustomerController {

    private final CustomerRepository customerRepository;
    private final MeterRepository meterRepository;

    public CustomerController(CustomerRepository customerRepository, MeterRepository meterRepository) {
        this.customerRepository = customerRepository;
        this.meterRepository = meterRepository;
    }

    @GetMapping("/me")
    public CustomerResponse me(Authentication authentication) {
        UUID customerId = UUID.fromString(authentication.getName());
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new DomainException("NOT_FOUND", "Client introuvable: " + customerId));
        return CustomerResponse.from(customer);
    }

    @GetMapping
    public List<CustomerResponse> list() {
        return customerRepository.findAll().stream().map(CustomerResponse::from).toList();
    }

    @PreAuthorize("hasAnyRole('CIE_ADMIN','DSI_ADMIN')")
    @GetMapping("/{id}")
    public CustomerResponse get(@PathVariable UUID id) {
        return CustomerResponse.from(findOrThrow(id));
    }

    // Contrairement à /auth/register (auto-inscription, toujours CLIENT), permet à un
    // admin de créer directement un compte opérateur/admin -- ce rôle n'existait
    // autrement que via un seed de migration (V4__seed_lab_operator.sql). Pas d'OTP/mot
    // de passe ici : le compte se connecte ensuite par le flux normal (login + OTP).
    @PreAuthorize("hasAnyRole('CIE_ADMIN','DSI_ADMIN')")
    @PostMapping
    public ResponseEntity<CustomerResponse> create(@Valid @RequestBody CreateCustomerRequest request) {
        if (customerRepository.findByPhoneNumber(request.phoneNumber()).isPresent()) {
            throw new DomainException("DUPLICATE", "Un compte existe déjà pour ce numéro: " + request.phoneNumber());
        }
        Customer customer = new Customer(request.phoneNumber(), request.displayName(),
                parseRole(request.role()), null);
        if (request.email() != null && !request.email().isBlank()) {
            customer.setEmail(request.email());
        }
        customerRepository.save(customer);
        return ResponseEntity.status(201).body(CustomerResponse.from(customer));
    }

    // Une session déjà ouverte (JWT existant) garde l'ancien rôle jusqu'à sa prochaine
    // connexion -- voir Customer.changeRole.
    @PreAuthorize("hasAnyRole('CIE_ADMIN','DSI_ADMIN')")
    @PatchMapping("/{id}/role")
    public CustomerResponse changeRole(@PathVariable UUID id, @Valid @RequestBody ChangeRoleRequest request) {
        Customer customer = findOrThrow(id);
        customer.changeRole(parseRole(request.role()));
        customerRepository.save(customer);
        return CustomerResponse.from(customer);
    }

    @PreAuthorize("hasAnyRole('CIE_ADMIN','DSI_ADMIN')")
    @PostMapping("/{id}/suspend")
    public CustomerResponse suspend(@PathVariable UUID id) {
        Customer customer = findOrThrow(id);
        customer.suspend();
        customerRepository.save(customer);
        return CustomerResponse.from(customer);
    }

    @PreAuthorize("hasAnyRole('CIE_ADMIN','DSI_ADMIN')")
    @PostMapping("/{id}/reactivate")
    public CustomerResponse reactivate(@PathVariable UUID id) {
        Customer customer = findOrThrow(id);
        customer.reactivate();
        customerRepository.save(customer);
        return CustomerResponse.from(customer);
    }

    // Assignation/réassignation : mêmes règles de validation qu'à l'inscription (voir
    // AuthService.register) -- meterId doit exister dans le registre et ne pas être déjà
    // lié à un AUTRE client. Réassigner le compteur déjà lié à CE client (no-op) est
    // accepté sans erreur.
    @PreAuthorize("hasAnyRole('CIE_ADMIN','DSI_ADMIN')")
    @PutMapping("/{id}/meter")
    public CustomerResponse assignMeter(@PathVariable UUID id, @Valid @RequestBody AssignMeterRequest request) {
        Customer customer = findOrThrow(id);
        meterRepository.findById(request.meterId())
                .orElseThrow(() -> new DomainException("NOT_FOUND", "Compteur inconnu: " + request.meterId()));
        customerRepository.findByMeterId(request.meterId()).ifPresent(other -> {
            if (!other.getCustomerId().equals(id)) {
                throw new DomainException("DUPLICATE",
                        "Ce compteur est déjà associé à un autre compte: " + request.meterId());
            }
        });
        customer.linkMeter(request.meterId(), request.contractId());
        customerRepository.save(customer);
        return CustomerResponse.from(customer);
    }

    @PreAuthorize("hasAnyRole('CIE_ADMIN','DSI_ADMIN')")
    @DeleteMapping("/{id}/meter")
    public CustomerResponse unassignMeter(@PathVariable UUID id) {
        Customer customer = findOrThrow(id);
        customer.unlinkMeter();
        customerRepository.save(customer);
        return CustomerResponse.from(customer);
    }

    private Customer findOrThrow(UUID id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new DomainException("NOT_FOUND", "Client introuvable: " + id));
    }

    private CustomerRole parseRole(String role) {
        try {
            return CustomerRole.valueOf(role);
        } catch (IllegalArgumentException e) {
            throw new DomainException("VALIDATION", "Rôle invalide: " + role);
        }
    }
}
