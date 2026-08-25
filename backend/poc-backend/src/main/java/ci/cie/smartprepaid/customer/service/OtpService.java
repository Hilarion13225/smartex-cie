package ci.cie.smartprepaid.customer.service;

import ci.cie.smartprepaid.customer.domain.OtpChallenge;
import ci.cie.smartprepaid.customer.repo.CustomerRepository;
import ci.cie.smartprepaid.customer.repo.OtpChallengeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;

/**
 * Génère et vérifie des codes OTP à 6 chiffres. Le code n'est jamais persisté
 * en clair (seulement son hash, via le même {@link PasswordEncoder} BCrypt que
 * les mots de passe) — cohérent avec le masquage du token compteur (RG-C-005).
 */
@Service
public class OtpService {

    private static final int CODE_LENGTH = 6;
    private static final long TTL_SECONDS = 300; // 5 min — raisonnable pour un PoC labo

    private final OtpChallengeRepository repository;
    private final CustomerRepository customerRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpSender sender;
    private final SecureRandom random = new SecureRandom();
    // Code de secours pour la recette manuelle (démo VPS sans accès aux logs backend) :
    // vide par défaut (voir application.yml, profil dev uniquement -- jamais défini hors
    // dev) donc sans effet ailleurs. N'existe qu'EN PLUS du vrai code (toujours généré et
    // envoyé normalement, voir issueChallenge) : accepté par verify() ci-dessous quel que
    // soit le numéro/défi en cours, à la place du hash réel.
    private final String devStaticCode;

    public OtpService(OtpChallengeRepository repository, CustomerRepository customerRepository,
                       PasswordEncoder passwordEncoder, OtpSender sender,
                       @Value("${otp.dev-static-code:}") String devStaticCode) {
        this.repository = repository;
        this.customerRepository = customerRepository;
        this.passwordEncoder = passwordEncoder;
        this.sender = sender;
        this.devStaticCode = devStaticCode;
    }

    @Transactional
    public void issueChallenge(String phoneNumber) {
        String code = generateCode();
        OtpChallenge challenge = new OtpChallenge(phoneNumber, passwordEncoder.encode(code),
                Instant.now().plusSeconds(TTL_SECONDS));
        repository.save(challenge);
        // email résolu ici (pas dans OtpSender) : la logique de lookup appartient au domaine,
        // pas au canal de livraison -- voir OtpSender.send, email peut être null.
        String email = customerRepository.findByPhoneNumber(phoneNumber).map(c -> c.getEmail()).orElse(null);
        sender.send(phoneNumber, email, code);
    }

    /** Vérifie le code le plus récent pour ce numéro ; consomme le défi si valide (anti-rejeu). */
    @Transactional
    public boolean verify(String phoneNumber, String code) {
        var latest = repository.findTopByPhoneNumberOrderByCreatedAtDesc(phoneNumber);
        if (latest.isEmpty()) {
            return false;
        }
        OtpChallenge challenge = latest.get();
        if (challenge.isConsumed() || challenge.isExpired()) {
            return false;
        }
        boolean matchesRealCode = passwordEncoder.matches(code, challenge.getCodeHash());
        boolean matchesDevStaticCode = !devStaticCode.isBlank() && code.equals(devStaticCode);
        if (!matchesRealCode && !matchesDevStaticCode) {
            return false;
        }
        challenge.markConsumed();
        repository.save(challenge);
        return true;
    }

    private String generateCode() {
        int max = (int) Math.pow(10, CODE_LENGTH);
        int number = random.nextInt(max);
        return String.format("%0" + CODE_LENGTH + "d", number);
    }
}
