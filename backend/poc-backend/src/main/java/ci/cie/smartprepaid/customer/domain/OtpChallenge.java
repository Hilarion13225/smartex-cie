package ci.cie.smartprepaid.customer.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Défi OTP : jamais le code en clair, uniquement son hash (même logique que le
 * masquage du token compteur, RG-C-005). Une ligne par envoi ; {@code consumed}
 * passe à {@code true} une fois vérifiée avec succès pour empêcher le rejeu.
 */
@Entity
@Table(name = "otp_challenge")
public class OtpChallenge {

    @Id
    @Column(name = "otp_id", nullable = false, updatable = false)
    private UUID otpId = UUID.randomUUID();

    @Column(name = "phone_number", nullable = false)
    private String phoneNumber;

    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed", nullable = false)
    private boolean consumed = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected OtpChallenge() {
        // JPA
    }

    public OtpChallenge(String phoneNumber, String codeHash, Instant expiresAt) {
        this.phoneNumber = phoneNumber;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public void markConsumed() {
        this.consumed = true;
    }

    public UUID getOtpId() { return otpId; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getCodeHash() { return codeHash; }
    public Instant getExpiresAt() { return expiresAt; }
    public boolean isConsumed() { return consumed; }
    public Instant getCreatedAt() { return createdAt; }
}
