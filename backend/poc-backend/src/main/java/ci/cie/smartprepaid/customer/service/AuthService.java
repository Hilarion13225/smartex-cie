package ci.cie.smartprepaid.customer.service;

import ci.cie.smartprepaid.common.DomainException;
import ci.cie.smartprepaid.customer.domain.Customer;
import ci.cie.smartprepaid.customer.domain.CustomerRole;
import ci.cie.smartprepaid.customer.repo.CustomerRepository;
import ci.cie.smartprepaid.meter.repo.MeterRepository;
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
    private final MeterRepository meterRepository;
    private final OtpService otpService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(CustomerRepository customerRepository, MeterRepository meterRepository,
                        OtpService otpService, JwtService jwtService, PasswordEncoder passwordEncoder) {
        this.customerRepository = customerRepository;
        this.meterRepository = meterRepository;
        this.otpService = otpService;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void register(String phoneNumber, String displayName, String password, String email,
                          String meterId, String contractId) {
        if (customerRepository.findByPhoneNumber(phoneNumber).isPresent()) {
            throw new DomainException("DUPLICATE", "Un compte existe déjà pour ce numéro: " + phoneNumber);
        }
        // password réservé à un usage futur (2FA/récupération) — jamais utilisé pour se
        // connecter en Phase 2 (OTP-only) ; optionnel pour ne pas bloquer un futur appel
        // qui n'en fournirait pas.
        String passwordHash = (password == null || password.isBlank()) ? null : passwordEncoder.encode(password);
        Customer customer = new Customer(phoneNumber, displayName, CustomerRole.CLIENT, passwordHash);
        if (email != null && !email.isBlank()) {
            customer.setEmail(email);
        }
        // Association Client<->Compteur réelle : validée contre le registre `meter` (géré
        // par l'admin, voir MeterController) -- jamais une valeur inventée/acceptée telle
        // quelle. Un compteur inconnu ou déjà lié à un autre client fait échouer
        // l'inscription explicitement (erreur honnête), plutôt que de laisser le client
        // croire qu'il verra les données d'un compteur qui n'est pas vraiment le sien.
        if (meterId != null && !meterId.isBlank()) {
            meterRepository.findById(meterId)
                    .orElseThrow(() -> new DomainException("NOT_FOUND", "Compteur inconnu: " + meterId));
            if (customerRepository.findByMeterId(meterId).isPresent()) {
                throw new DomainException("DUPLICATE", "Ce compteur est déjà associé à un autre compte: " + meterId);
            }
            customer.linkMeter(meterId, contractId);
        }
        customerRepository.save(customer);
        otpService.issueChallenge(phoneNumber);
    }

    public void login(String phoneNumber) {
        Customer customer = customerRepository.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new DomainException("NOT_FOUND", "Aucun compte pour ce numéro: " + phoneNumber));
        // Bloqué avant même l'envoi de l'OTP (module de gestion admin, voir
        // CustomerController#suspend) -- pas la peine de faire croire qu'une connexion est
        // possible en envoyant un code qui sera de toute façon refusé à verifyOtp.
        if (!customer.isActive()) {
            throw new DomainException("INELIGIBLE", "Ce compte a été suspendu — contactez le support");
        }
        otpService.issueChallenge(phoneNumber);
    }

    @Transactional
    public VerifiedLogin verifyOtp(String phoneNumber, String code) {
        if (!otpService.verify(phoneNumber, code)) {
            throw new DomainException("VALIDATION", "Code OTP invalide ou expiré");
        }
        Customer customer = customerRepository.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new DomainException("NOT_FOUND", "Aucun compte pour ce numéro: " + phoneNumber));
        // Filet de sécurité si le compte a été suspendu entre l'envoi de l'OTP et sa
        // vérification (fenêtre étroite mais réelle, voir TTL de 5 min dans OtpService).
        if (!customer.isActive()) {
            throw new DomainException("INELIGIBLE", "Ce compte a été suspendu — contactez le support");
        }
        customer.markPhoneVerified();
        customer.recordLogin();
        customerRepository.save(customer);
        String token = jwtService.generate(customer.getCustomerId(), customer.getRole());
        return new VerifiedLogin(customer, token);
    }

    public record VerifiedLogin(Customer customer, String token) {}
}
