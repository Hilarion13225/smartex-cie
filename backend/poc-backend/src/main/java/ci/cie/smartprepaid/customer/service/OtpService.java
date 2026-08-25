package ci.cie.smartprepaid.customer.service;

import ci.cie.smartprepaid.customer.domain.OtpChallenge;
import ci.cie.smartprepaid.customer.repo.OtpChallengeRepository;
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
    private final PasswordEncoder passwordEncoder;
    private final OtpSender sender;
    private final SecureRandom random = new SecureRandom();

    public OtpService(OtpChallengeRepository repository, PasswordEncoder passwordEncoder, OtpSender sender) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.sender = sender;
    }

    @Transactional
    public void issueChallenge(String phoneNumber) {
        String code = generateCode();
        OtpChallenge challenge = new OtpChallenge(phoneNumber, passwordEncoder.encode(code),
                Instant.now().plusSeconds(TTL_SECONDS));
        repository.save(challenge);
        sender.send(phoneNumber, code);
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
        if (!passwordEncoder.matches(code, challenge.getCodeHash())) {
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
