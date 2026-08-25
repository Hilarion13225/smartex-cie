package ci.cie.smartprepaid.customer.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Domaine customer/auth (docs/05_reconciliation-api-frontend-backend.md §8).
 * Mécanisme d'authentification : OTP-only (décision validée) — {@code passwordHash}
 * est collecté à l'inscription (le frontend le demande) et stocké pour un usage
 * futur (2FA / récupération de compte), mais n'est jamais utilisé pour authentifier
 * en Phase 2 : c'est la vérification OTP qui fait foi (voir AuthService).
 */
@Entity
@Table(name = "customer")
public class Customer {

    @Id
    @Column(name = "customer_id", nullable = false, updatable = false)
    private UUID customerId = UUID.randomUUID();

    @Column(name = "phone_number", nullable = false, unique = true)
    private String phoneNumber;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private CustomerRole role;

    /** Réservé à un usage futur (2FA/récupération) — non utilisé pour se connecter (OTP-only). */
    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "phone_verified", nullable = false)
    private boolean phoneVerified = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Customer() {
        // JPA
    }

    public Customer(String phoneNumber, String displayName, CustomerRole role, String passwordHash) {
        this.phoneNumber = phoneNumber;
        this.displayName = displayName;
        this.role = role;
        this.passwordHash = passwordHash;
    }

    public void markPhoneVerified() {
        this.phoneVerified = true;
    }

    public UUID getCustomerId() { return customerId; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getDisplayName() { return displayName; }
    public CustomerRole getRole() { return role; }
    public String getPasswordHash() { return passwordHash; }
    public boolean isPhoneVerified() { return phoneVerified; }
    public Instant getCreatedAt() { return createdAt; }
}
