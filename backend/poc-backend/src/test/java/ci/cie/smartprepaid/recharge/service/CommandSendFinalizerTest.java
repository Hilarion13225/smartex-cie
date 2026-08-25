package ci.cie.smartprepaid.recharge.service;

import ci.cie.smartprepaid.audit.service.AuditService;
import ci.cie.smartprepaid.mqtt.CommandPublisher;
import ci.cie.smartprepaid.recharge.domain.CommandStatus;
import ci.cie.smartprepaid.recharge.domain.RechargeStatus;
import ci.cie.smartprepaid.recharge.repo.CommandRepository;
import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Test purement unitaire (pas de contexte Spring, pas de DB) : vérifie que
 * {@link CommandSendFinalizer} passe bien par les UPDATE conditionnels atomiques
 * (markSentIfStatus/markStatusIfStatus) plutôt que par un pattern find() + check en
 * mémoire + save() -- ce dernier a provoqué un "lost update" réel découvert sous
 * charge légère (T14, docs/04_dossier-recette-gate1.md §3ter) : un ACK très rapide
 * (concurrent avec cette méthode) committant ACCEPTED pouvait être silencieusement
 * écrasé par SENT quelques millisecondes plus tard.
 */
class CommandSendFinalizerTest {

    private CommandPublisher commandPublisher;
    private CommandRepository commandRepository;
    private RechargeRepository rechargeRepository;
    private AuditService auditService;
    private CommandSendFinalizer finalizer;

    @BeforeEach
    void setUp() {
        commandPublisher = mock(CommandPublisher.class);
        commandRepository = mock(CommandRepository.class);
        rechargeRepository = mock(RechargeRepository.class);
        auditService = mock(AuditService.class);
        finalizer = new CommandSendFinalizer(commandPublisher, commandRepository, rechargeRepository, auditService);
    }

    @Test
    void publishAndMarkSent_utiliseDesUpdatesAtomiquesConditionnels_pasDeFindPuisSave() {
        UUID commandId = UUID.randomUUID();
        UUID rechargeId = UUID.randomUUID();

        finalizer.publishAndMarkSent(commandId, rechargeId, "DONGLE-LAB-0001", "corr-1",
                "LABTKN-test", 1L, Instant.now().plusSeconds(60), new BigDecimal("1000"));

        verify(commandPublisher).publishTokenCommand(eq("DONGLE-LAB-0001"), eq(commandId), eq("corr-1"),
                eq("LABTKN-test"), eq(1L), any(Instant.class), eq(new BigDecimal("1000")));

        // Le coeur du correctif : UPDATE conditionnel atomique (0 lecture-modification-écriture
        // en mémoire, donc pas de fenêtre de course possible avec un ACK concurrent).
        verify(commandRepository).markSentIfStatus(eq(commandId), eq(CommandStatus.PENDING),
                eq(CommandStatus.SENT), any(Instant.class));
        verify(rechargeRepository).markStatusIfStatus(eq(rechargeId), eq(RechargeStatus.TOKEN_GENERATED),
                eq(RechargeStatus.COMMAND_SENT), any(Instant.class));

        // L'ancien pattern (vulnérable au lost update) ne doit plus jamais être utilisé ici.
        verify(commandRepository, never()).findById(any());
        verify(commandRepository, never()).save(any());
        verify(rechargeRepository, never()).findById(any());
        verify(rechargeRepository, never()).save(any());

        verify(auditService).record(eq("corr-1"), anyString(), eq("COMMAND_SENT"), anyString(),
                eq(commandId.toString()), eq("SENT"), any(), anyString());
    }
}
