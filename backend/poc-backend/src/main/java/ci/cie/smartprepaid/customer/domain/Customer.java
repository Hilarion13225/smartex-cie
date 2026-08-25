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

    /** Dernière connexion réussie (OTP vérifié) — voir AuthService#verifyOtp. Null tant
     * qu'aucune connexion n'a encore eu lieu (juste après l'inscription). */
    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    /** Utilisé pour l'envoi du code OTP par email (voir BrevoOtpSender) — optionnel. */
    @Column(name = "email")
    private String email;

    /** Association Client<->Compteur réelle (voir meter.domain.Meter, V8 migration) --
     * null tant qu'aucun compteur n'a été validé/lié (comptes existants avant cette
     * fonctionnalité, ou rôles support sans compteur propre). UNIQUE en base : un compteur
     * n'appartient qu'à un seul client (voir AuthService.register). */
    @Column(name = "meter_id")
    private String meterId;

    /** Fourni par le client à l'inscription, jamais vérifié contre un registre de contrats
     * réel (qui n'existe pas dans ce PoC) -- conservé tel quel, à titre de référence. */
    @Column(name = "contract_id")
    private String contractId;

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

    public void recordLogin() {
        this.lastLoginAt = Instant.now();
    }

    public void setEmail(String email) {
        this.email = email;
    }

    /** Lie ce client à un compteur du registre (voir MeterRepository) et conserve le
     * numéro de contrat déclaré -- appelé uniquement après validation (meterId existant
     * dans le registre ET pas déjà lié à un autre client), voir AuthService.register. */
    public void linkMeter(String meterId, String contractId) {
        this.meterId = meterId;
        this.contractId = contractId;
    }

    public UUID getCustomerId() { return customerId; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getDisplayName() { return displayName; }
    public CustomerRole getRole() { return role; }
    public String getPasswordHash() { return passwordHash; }
    public boolean isPhoneVerified() { return phoneVerified; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastLoginAt() { return lastLoginAt; }
    public String getEmail() { return email; }
    public String getMeterId() { return meterId; }
    public String getContractId() { return contractId; }
}
