package ci.cie.smartprepaid.customer.service;

import ci.cie.smartprepaid.common.DomainException;
import ci.cie.smartprepaid.customer.domain.Customer;
import ci.cie.smartprepaid.customer.domain.CustomerRole;
import ci.cie.smartprepaid.customer.repo.CustomerRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orchestration inscription/connexion/vérification OTP (domaine customer/auth,
 * voir docs/05_reconciliation-api-frontend-backend.md §8). Mécanisme
 * OTP-only (décision validée) : {@code login} ne prend qu'un numéro de
 * téléphone (pas de mot de passe) et déclenche un nouvel envoi OTP, exactement
 * comme le fait l'écran de connexion réel du frontend.
 */
@Service
public class AuthService {

    private final CustomerRepository customerRepository;
    private final OtpService otpService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(CustomerRepository customerRepository, OtpService otpService, JwtService jwtService,
                        PasswordEncoder passwordEncoder) {
        this.customerRepository = customerRepository;
        this.otpService = otpService;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void register(String phoneNumber, String displayName, String password) {
        if (customerRepository.findByPhoneNumber(phoneNumber).isPresent()) {
            throw new DomainException("DUPLICATE", "Un compte existe déjà pour ce numéro: " + phoneNumber);
        }
        // password réservé à un usage futur (2FA/récupération) — jamais utilisé pour se
        // connecter en Phase 2 (OTP-only) ; optionnel pour ne pas bloquer un futur appel
        // qui n'en fournirait pas.
        String passwordHash = (password == null || password.isBlank()) ? null : passwordEncoder.encode(password);
        Customer customer = new Customer(phoneNumber, displayName, CustomerRole.CLIENT, passwordHash);
        customerRepository.save(customer);
        otpService.issueChallenge(phoneNumber);
    }

    public void login(String phoneNumber) {
        customerRepository.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new DomainException("NOT_FOUND", "Aucun compte pour ce numéro: " + phoneNumber));
        otpService.issueChallenge(phoneNumber);
    }

    @Transactional
    public VerifiedLogin verifyOtp(String phoneNumber, String code) {
        if (!otpService.verify(phoneNumber, code)) {
            throw new DomainException("VALIDATION", "Code OTP invalide ou expiré");
        }
        Customer customer = customerRepository.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new DomainException("NOT_FOUND", "Aucun compte pour ce numéro: " + phoneNumber));
        customer.markPhoneVerified();
        customerRepository.save(customer);
        String token = jwtService.generate(customer.getCustomerId(), customer.getRole());
        return new VerifiedLogin(customer, token);
    }

    public record VerifiedLogin(Customer customer, String token) {}
}
