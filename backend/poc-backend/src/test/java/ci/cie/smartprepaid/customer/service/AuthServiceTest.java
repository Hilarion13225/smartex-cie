package ci.cie.smartprepaid.customer.service;

import ci.cie.smartprepaid.common.DomainException;
import ci.cie.smartprepaid.customer.domain.Customer;
import ci.cie.smartprepaid.customer.domain.CustomerRole;
import ci.cie.smartprepaid.customer.repo.CustomerRepository;
import ci.cie.smartprepaid.meter.domain.Meter;
import ci.cie.smartprepaid.meter.repo.MeterRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Test purement unitaire (pas de contexte Spring, pas de DB) : logique
 * d'orchestration register/login/verify-otp du domaine customer/auth, en
 * particulier les cas valides/invalides demandés (login connu/inconnu,
 * OTP correct/incorrect).
 */
class AuthServiceTest {

    private CustomerRepository customerRepository;
    private MeterRepository meterRepository;
    private OtpService otpService;
    private JwtService jwtService;
    private PasswordEncoder passwordEncoder;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        customerRepository = mock(CustomerRepository.class);
        meterRepository = mock(MeterRepository.class);
        otpService = mock(OtpService.class);
        jwtService = mock(JwtService.class);
        passwordEncoder = mock(PasswordEncoder.class);
        authService = new AuthService(customerRepository, meterRepository, otpService, jwtService, passwordEncoder);
    }

    @Test
    void registerAvecNumeroDejaUtilise_estRejete() {
        when(customerRepository.findByPhoneNumber("0700000000"))
                .thenReturn(Optional.of(new Customer("0700000000", "Jean", CustomerRole.CLIENT, null)));

        assertThatThrownBy(() -> authService.register("0700000000", "Jean", "Test@1234", null, null, null))
                .isInstanceOf(DomainException.class)
                .extracting(e -> ((DomainException) e).getCode())
                .isEqualTo("DUPLICATE");
        verify(otpService, never()).issueChallenge(any());
    }

    @Test
    void registerAvecNumeroLibre_creeLeClientEtDeclencheUnEnvoiOtp() {
        when(customerRepository.findByPhoneNumber("0700000000")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("Test@1234")).thenReturn("hashed-password");

        authService.register("0700000000", "Jean", "Test@1234", null, null, null);

        verify(customerRepository).save(any(Customer.class));
        verify(otpService).issueChallenge("0700000000");
    }

    @Test
    void registerAvecCompteurInconnu_estRejeteSansCreerLeClient() {
        when(customerRepository.findByPhoneNumber("0700000000")).thenReturn(Optional.empty());
        when(meterRepository.findById("METER-X")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.register("0700000000", "Jean", null, null, "METER-X", "CONTRAT-1"))
                .isInstanceOf(DomainException.class)
                .extracting(e -> ((DomainException) e).getCode())
                .isEqualTo("NOT_FOUND");
        verify(customerRepository, never()).save(any());
        verify(otpService, never()).issueChallenge(any());
    }

    @Test
    void registerAvecCompteurDejaAssocieAUnAutreClient_estRejete() {
        when(customerRepository.findByPhoneNumber("0700000000")).thenReturn(Optional.empty());
        when(meterRepository.findById("CIE-LAB-0001")).thenReturn(Optional.of(new Meter("CIE-LAB-0001", "Labo")));
        when(customerRepository.findByMeterId("CIE-LAB-0001"))
                .thenReturn(Optional.of(new Customer("0788888888", "Autre", CustomerRole.CLIENT, null)));

        assertThatThrownBy(() -> authService.register("0700000000", "Jean", null, null, "CIE-LAB-0001", null))
                .isInstanceOf(DomainException.class)
                .extracting(e -> ((DomainException) e).getCode())
                .isEqualTo("DUPLICATE");
        verify(customerRepository, never()).save(any());
    }

    @Test
    void registerAvecCompteurValideEtLibre_lieLeCompteurAuNouveauClient() {
        when(customerRepository.findByPhoneNumber("0700000000")).thenReturn(Optional.empty());
        when(meterRepository.findById("CIE-LAB-0001")).thenReturn(Optional.of(new Meter("CIE-LAB-0001", "Labo")));
        when(customerRepository.findByMeterId("CIE-LAB-0001")).thenReturn(Optional.empty());

        authService.register("0700000000", "Jean", null, "jean@example.com", "CIE-LAB-0001", "CONTRAT-1");

        verify(customerRepository).save(argThat(c ->
                "CIE-LAB-0001".equals(c.getMeterId())
                        && "CONTRAT-1".equals(c.getContractId())
                        && "jean@example.com".equals(c.getEmail())));
        verify(otpService).issueChallenge("0700000000");
    }

    @Test
    void loginAvecNumeroInconnu_estRejeteEtNeDeclencheAucunOtp() {
        when(customerRepository.findByPhoneNumber("0799999999")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login("0799999999"))
                .isInstanceOf(DomainException.class)
                .extracting(e -> ((DomainException) e).getCode())
                .isEqualTo("NOT_FOUND");
        verify(otpService, never()).issueChallenge(any());
    }

    @Test
    void loginAvecNumeroConnu_declencheUnNouvelEnvoiOtp() {
        when(customerRepository.findByPhoneNumber("0700000000"))
                .thenReturn(Optional.of(new Customer("0700000000", "Jean", CustomerRole.CLIENT, null)));

        authService.login("0700000000");

        verify(otpService).issueChallenge("0700000000");
    }

    @Test
    void verifyOtpAvecCodeInvalide_estRejete() {
        when(otpService.verify("0700000000", "000000")).thenReturn(false);

        assertThatThrownBy(() -> authService.verifyOtp("0700000000", "000000"))
                .isInstanceOf(DomainException.class)
                .extracting(e -> ((DomainException) e).getCode())
                .isEqualTo("VALIDATION");
        verify(customerRepository, never()).save(any());
    }

    @Test
    void verifyOtpAvecCodeValide_emetUnJwtEtMarqueLeTelephoneVerifie() {
        Customer customer = new Customer("0700000000", "Jean", CustomerRole.CLIENT, null);
        when(otpService.verify("0700000000", "123456")).thenReturn(true);
        when(customerRepository.findByPhoneNumber("0700000000")).thenReturn(Optional.of(customer));
        when(jwtService.generate(customer.getCustomerId(), CustomerRole.CLIENT)).thenReturn("signed.jwt.token");

        var result = authService.verifyOtp("0700000000", "123456");

        assertThat(result.token()).isEqualTo("signed.jwt.token");
        assertThat(result.customer().isPhoneVerified()).isTrue();
        verify(customerRepository).save(customer);
    }
}
