package ci.cie.smartprepaid.security;

import ci.cie.smartprepaid.audit.api.AuditController;
import ci.cie.smartprepaid.audit.service.AuditService;
import ci.cie.smartprepaid.customer.domain.CustomerRole;
import ci.cie.smartprepaid.customer.security.SecurityConfig;
import ci.cie.smartprepaid.customer.service.JwtService;
import ci.cie.smartprepaid.payment.repo.PaymentRepository;
import ci.cie.smartprepaid.recharge.api.RechargeController;
import ci.cie.smartprepaid.recharge.domain.CommandStatus;
import ci.cie.smartprepaid.recharge.domain.MeterCommand;
import ci.cie.smartprepaid.recharge.domain.Recharge;
import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
import ci.cie.smartprepaid.recharge.security.RechargeAuthorization;
import ci.cie.smartprepaid.recharge.service.RechargeOrchestrator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Vérifie à la couche HTTP (filtre JWT + method security + rôles) le correctif
 * "trou d'autorisation" : un client authentifié mais non-propriétaire ne doit
 * pas accéder à la recharge d'un autre client, et seuls les rôles support
 * peuvent relancer une commande ou consulter l'audit/le support timeline.
 * Utilise de vrais JWT (signés par le {@link JwtService} réel importé dans le
 * contexte) plutôt que des mocks Spring Security, pour couvrir l'ensemble de
 * la chaîne réellement exécutée en production (JwtAuthenticationFilter ->
 * SecurityConfig -> @PreAuthorize).
 */
@WebMvcTest(controllers = {RechargeController.class, AuditController.class})
@Import({SecurityConfig.class, JwtService.class, RechargeAuthorization.class})
@TestPropertySource(properties = {
        "jwt.secret=test-secret-at-least-32-bytes-long-for-hs256!!",
        "jwt.expiration-seconds=3600"
})
class AuthorizationHttpTest {

    @Autowired
    private org.springframework.test.web.servlet.MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private RechargeOrchestrator orchestrator;

    @MockBean
    private PaymentRepository paymentRepository;

    @MockBean
    private RechargeRepository rechargeRepository;

    @MockBean
    private AuditService auditService;

    @Test
    void clientAuthentifie_neVoitPasLaRechargeDunAutreClient() throws Exception {
        UUID owner = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        UUID rechargeId = UUID.randomUUID();
        Recharge recharge = new Recharge(UUID.randomUUID(), "CIE-LAB-0001", owner.toString(),
                BigDecimal.TEN, "idem-owner", "corr-owner");
        when(rechargeRepository.findById(rechargeId)).thenReturn(Optional.of(recharge));

        mockMvc.perform(get("/api/v1/recharges/{id}", rechargeId)
                        .header("Authorization", bearer(other, CustomerRole.CLIENT)))
                .andExpect(status().isForbidden());
    }

    @Test
    void clientAuthentifie_voitSaPropreRecharge() throws Exception {
        UUID owner = UUID.randomUUID();
        UUID rechargeId = UUID.randomUUID();
        Recharge recharge = new Recharge(UUID.randomUUID(), "CIE-LAB-0001", owner.toString(),
                BigDecimal.TEN, "idem-self", "corr-self");
        when(rechargeRepository.findById(rechargeId)).thenReturn(Optional.of(recharge));
        when(orchestrator.findRechargeOrThrow(rechargeId)).thenReturn(recharge);
        when(orchestrator.findCommandsForRecharge(rechargeId)).thenReturn(List.of());
        when(paymentRepository.findById(any())).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/recharges/{id}", rechargeId)
                        .header("Authorization", bearer(owner, CustomerRole.CLIENT)))
                .andExpect(status().isOk());
    }

    @Test
    void operateurCie_voitNimporteQuelleRecharge() throws Exception {
        UUID owner = UUID.randomUUID();
        UUID operator = UUID.randomUUID();
        UUID rechargeId = UUID.randomUUID();
        Recharge recharge = new Recharge(UUID.randomUUID(), "CIE-LAB-0001", owner.toString(),
                BigDecimal.TEN, "idem-op", "corr-op");
        when(orchestrator.findRechargeOrThrow(rechargeId)).thenReturn(recharge);
        when(orchestrator.findCommandsForRecharge(rechargeId)).thenReturn(List.of());
        when(paymentRepository.findById(any())).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/v1/recharges/{id}", rechargeId)
                        .header("Authorization", bearer(operator, CustomerRole.CIE_OPERATOR)))
                .andExpect(status().isOk());
    }

    @Test
    void client_nePeutPasRelancerUneCommande() throws Exception {
        mockMvc.perform(post("/api/v1/commands/{id}/retry", UUID.randomUUID())
                        .header("Authorization", bearer(UUID.randomUUID(), CustomerRole.CLIENT)))
                .andExpect(status().isForbidden());
    }

    @Test
    void operateurCie_peutRelancerUneCommande() throws Exception {
        UUID commandId = UUID.randomUUID();
        MeterCommand command = new MeterCommand(UUID.randomUUID(), "DONGLE-LAB-0001", "corr-retry",
                "hash", 1L, Instant.now().plusSeconds(60));
        when(orchestrator.retryCommand(any(), any(), any())).thenReturn(command);

        mockMvc.perform(post("/api/v1/commands/{id}/retry", commandId)
                        .header("Authorization", bearer(UUID.randomUUID(), CustomerRole.CIE_OPERATOR)))
                .andExpect(status().isOk());
    }

    @Test
    void client_nePeutPasConsulterLAudit() throws Exception {
        mockMvc.perform(get("/api/v1/audit").param("correlationId", "corr-1")
                        .header("Authorization", bearer(UUID.randomUUID(), CustomerRole.CLIENT)))
                .andExpect(status().isForbidden());
    }

    @Test
    void operateurCie_peutConsulterLAudit() throws Exception {
        when(auditService.byCorrelationId("corr-1")).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/audit").param("correlationId", "corr-1")
                        .header("Authorization", bearer(UUID.randomUUID(), CustomerRole.CIE_OPERATOR)))
                .andExpect(status().isOk());
    }

    private String bearer(UUID customerId, CustomerRole role) {
        return "Bearer " + jwtService.generate(customerId, role);
    }
}
