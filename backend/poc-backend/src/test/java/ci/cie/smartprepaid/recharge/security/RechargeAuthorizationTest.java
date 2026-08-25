package ci.cie.smartprepaid.recharge.security;

import ci.cie.smartprepaid.recharge.domain.Recharge;
import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Test purement unitaire (pas de contexte Spring) de la logique d'ownership
 * réutilisée par {@code @PreAuthorize} sur RechargeController#get.
 */
class RechargeAuthorizationTest {

    private RechargeRepository rechargeRepository;
    private RechargeAuthorization authorization;

    @BeforeEach
    void setUp() {
        rechargeRepository = mock(RechargeRepository.class);
        authorization = new RechargeAuthorization(rechargeRepository);
    }

    @Test
    void proprietaireDeLaRecharge_estAutorise() {
        UUID customerId = UUID.randomUUID();
        UUID rechargeId = UUID.randomUUID();
        Recharge recharge = new Recharge(UUID.randomUUID(), "CIE-LAB-0001", customerId.toString(),
                BigDecimal.TEN, "idem-1", "corr-1");
        when(rechargeRepository.findById(rechargeId)).thenReturn(Optional.of(recharge));
        Authentication authentication = authenticationFor(customerId);

        assertThat(authorization.isOwner(rechargeId, authentication)).isTrue();
    }

    @Test
    void clientDifferentDuProprietaire_estRefuse() {
        UUID owner = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        UUID rechargeId = UUID.randomUUID();
        Recharge recharge = new Recharge(UUID.randomUUID(), "CIE-LAB-0001", owner.toString(),
                BigDecimal.TEN, "idem-2", "corr-2");
        when(rechargeRepository.findById(rechargeId)).thenReturn(Optional.of(recharge));
        Authentication authentication = authenticationFor(other);

        assertThat(authorization.isOwner(rechargeId, authentication)).isFalse();
    }

    @Test
    void rechargeInexistante_nEstPasBloqueeIci_pourLaisserLe404Metier() {
        UUID rechargeId = UUID.randomUUID();
        when(rechargeRepository.findById(rechargeId)).thenReturn(Optional.empty());

        assertThat(authorization.isOwner(rechargeId, authenticationFor(UUID.randomUUID()))).isTrue();
    }

    @Test
    void authentificationAbsente_estRefusee() {
        assertThat(authorization.isOwner(UUID.randomUUID(), null)).isFalse();
    }

    private Authentication authenticationFor(UUID customerId) {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn(customerId.toString());
        return authentication;
    }
}
