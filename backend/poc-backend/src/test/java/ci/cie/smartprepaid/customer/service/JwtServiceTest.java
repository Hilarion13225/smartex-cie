package ci.cie.smartprepaid.customer.service;

import ci.cie.smartprepaid.customer.domain.CustomerRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test purement unitaire (pas de contexte Spring) : génération/validation JWT
 * en isolation, en particulier le rejet des tokens expirés/invalides qui
 * protège les endpoints authentifiés (voir JwtAuthenticationFilter).
 */
class JwtServiceTest {

    private static final String SECRET = "test-secret-at-least-32-bytes-long-for-hs256!!";

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, 3600);
    }

    @Test
    void tokenValide_estAccepteEtPorteLesBonnesClaims() {
        UUID customerId = UUID.randomUUID();

        String token = jwtService.generate(customerId, CustomerRole.CLIENT);
        var claims = jwtService.validate(token);

        assertThat(claims).isPresent();
        assertThat(claims.get().getSubject()).isEqualTo(customerId.toString());
        assertThat(claims.get().get("role", String.class)).isEqualTo("CLIENT");
    }

    @Test
    void tokenExpire_estRejete() {
        // expiration-seconds négatif -> le token est déjà expiré au moment de sa génération.
        JwtService expiredIssuer = new JwtService(SECRET, -10);
        String token = expiredIssuer.generate(UUID.randomUUID(), CustomerRole.CLIENT);

        assertThat(jwtService.validate(token)).isEmpty();
    }

    @Test
    void tokenSigneAvecUneAutreCle_estRejete() {
        JwtService otherIssuer = new JwtService("une-autre-cle-totalement-differente-32-octets!!", 3600);
        String token = otherIssuer.generate(UUID.randomUUID(), CustomerRole.CLIENT);

        assertThat(jwtService.validate(token)).isEmpty();
    }

    @Test
    void tokenMalforme_estRejeteSansException() {
        assertThat(jwtService.validate("ceci-nest-pas-un-jwt")).isEmpty();
    }
}
