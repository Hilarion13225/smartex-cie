package ci.cie.smartprepaid.recharge;

import ci.cie.smartprepaid.audit.service.AuditService;
import ci.cie.smartprepaid.device.domain.Device;
import ci.cie.smartprepaid.device.service.DeviceService;
import ci.cie.smartprepaid.mqtt.CommandPublisher;
import ci.cie.smartprepaid.mqtt.MqttProperties;
import ci.cie.smartprepaid.recharge.domain.CommandStatus;
import ci.cie.smartprepaid.recharge.domain.MeterCommand;
import ci.cie.smartprepaid.recharge.domain.Recharge;
import ci.cie.smartprepaid.recharge.domain.RechargeStatus;
import ci.cie.smartprepaid.recharge.repo.CommandRepository;
import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
import ci.cie.smartprepaid.recharge.service.CommandDispatcher;
import ci.cie.smartprepaid.recharge.service.CommandSendFinalizer;
import ci.cie.smartprepaid.recharge.service.RechargeOrchestrator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Test purement unitaire (pas de contexte Spring, pas de DB, pas de broker MQTT
 * réel) : vérifie exclusivement la logique d'idempotence de RechargeOrchestrator,
 * qui est la règle non-négociable la plus critique du PoC (voir CLAUDE.md).
 *
 * NB: ce test n'a pas été exécuté dans cet environnement (pas d'accès Maven
 * Central en sandbox) — à lancer avec `mvn -pl backend/poc-backend test` en local.
 */
class RechargeOrchestratorIdempotencyTest {

    private RechargeRepository rechargeRepository;
    private CommandRepository commandRepository;
    private DeviceService deviceService;
    private CommandPublisher commandPublisher;
    private AuditService auditService;
    private RechargeOrchestrator orchestrator;

    @BeforeEach
    void setUp() {
        rechargeRepository = mock(RechargeRepository.class);
        commandRepository = mock(CommandRepository.class);
        deviceService = mock(DeviceService.class);
        commandPublisher = mock(CommandPublisher.class);
        auditService = mock(AuditService.class);

        MqttProperties props = new MqttProperties();
        props.setCommandTtlSeconds(60);

        // Pas de contexte Spring dans ce test: aucune transaction n'est active, donc
        // CommandDispatcher publie et marque la commande "sent" de façon synchrone
        // (cf. branche else de dispatchAfterCommit), comme l'ancien code inline.
        CommandSendFinalizer finalizer = new CommandSendFinalizer(commandPublisher, commandRepository,
                rechargeRepository, auditService);
        CommandDispatcher commandDispatcher = new CommandDispatcher(finalizer);

        orchestrator = new RechargeOrchestrator(rechargeRepository, commandRepository, deviceService,
                commandDispatcher, auditService, props);

        when(rechargeRepository.save(any(Recharge.class))).thenAnswer(inv -> inv.getArgument(0));
        when(commandRepository.save(any(MeterCommand.class))).thenAnswer(inv -> inv.getArgument(0));
        when(deviceService.findByMeterIdOrThrow(anyString()))
                .thenReturn(new Device("DONGLE-LAB-0001", "CIE-LAB-0001", "cert", "0.1.0"));
        when(commandRepository.findTopByDeviceIdOrderBySequenceDesc(anyString())).thenReturn(Optional.empty());
    }

    @Test
    void memeIdempotencyKey_neCreeQuUneSeuleRecharge() {
        // Premier appel : aucune recharge existante avec cette clé.
        when(rechargeRepository.findByIdempotencyKey("KEY-1"))
                .thenReturn(Optional.empty());

        Recharge first = orchestrator.startManual(UUID.randomUUID(), "CIE-LAB-0001", "CUST-1",
                new BigDecimal("5000"), "KEY-1", "corr-1", false);

        // On simule que la recharge est maintenant persistée sous cette clé.
        when(rechargeRepository.findByIdempotencyKey("KEY-1")).thenReturn(Optional.of(first));

        Recharge second = orchestrator.startManual(UUID.randomUUID(), "CIE-LAB-0001", "CUST-1",
                new BigDecimal("5000"), "KEY-1", "corr-2", false);

        assertThat(second.getRechargeId()).isEqualTo(first.getRechargeId());
        // Une seule commande doit avoir été publiée sur le broker MQTT malgré les deux appels.
        verify(commandPublisher, times(1)).publishTokenCommand(anyString(), any(), anyString(), anyString(),
                anyLong(), any(Instant.class), any(BigDecimal.class));
    }

    @Test
    void ackDupliqueSurCommandeTerminale_estIgnore() {
        UUID rechargeId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();

        Recharge recharge = new Recharge(UUID.randomUUID(), "CIE-LAB-0001", "CUST-1",
                new BigDecimal("5000"), "KEY-2", "corr-1");
        MeterCommand command = new MeterCommand(rechargeId, "DONGLE-LAB-0001", "corr-1", "hash",
                1L, Instant.now().plusSeconds(60));
        // Première ACK déjà traitée -> commande dans un état terminal.
        command.markAcked(CommandStatus.ACCEPTED);

        when(commandRepository.findById(commandId)).thenReturn(Optional.of(command));
        when(rechargeRepository.findById(any())).thenReturn(Optional.of(recharge));

        orchestrator.handleAck(commandId, CommandStatus.ACCEPTED, "corr-1-replay");

        // Le statut ne doit pas être modifié une seconde fois, et aucun audit "succès" dupliqué.
        verify(commandRepository, never()).save(any());
        verify(auditService).record(eq("corr-1-replay"), anyString(), eq("ACK_DUPLICATE_IGNORED"),
                anyString(), anyString(), anyString(), any(), anyString());
    }

    @Test
    void forceInvalidToken_publieUnTokenAvecLeMarqueurInvalid() {
        // T05 (endpoint de recette): forceInvalidToken=true doit produire un token
        // contenant le marqueur INVALID reconnu par le mock-dongle (dongle.py).
        when(rechargeRepository.findByIdempotencyKey("KEY-T05")).thenReturn(Optional.empty());
        ArgumentCaptor<String> tokenCaptor = ArgumentCaptor.forClass(String.class);

        orchestrator.startManual(UUID.randomUUID(), "CIE-LAB-0001", "CUST-1",
                new BigDecimal("2000"), "KEY-T05", "corr-t05", true);

        verify(commandPublisher).publishTokenCommand(anyString(), any(), anyString(), tokenCaptor.capture(),
                anyLong(), any(Instant.class), any(BigDecimal.class));
        assertThat(tokenCaptor.getValue()).contains("INVALID");
    }

    @Test
    void ackRejected_transitionneLaRechargeVersCommandRejected() {
        UUID rechargeId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();

        Recharge recharge = new Recharge(UUID.randomUUID(), "CIE-LAB-0001", "CUST-1",
                new BigDecimal("2000"), "KEY-T05-ACK", "corr-t05-ack");
        MeterCommand command = new MeterCommand(rechargeId, "DONGLE-LAB-0001", "corr-t05-ack", "hash",
                1L, Instant.now().plusSeconds(60));

        when(commandRepository.findById(commandId)).thenReturn(Optional.of(command));
        when(rechargeRepository.findById(any())).thenReturn(Optional.of(recharge));

        orchestrator.handleAck(commandId, CommandStatus.REJECTED, "corr-t05-ack");

        assertThat(command.getStatus()).isEqualTo(CommandStatus.REJECTED);
        assertThat(recharge.getStatus()).isEqualTo(RechargeStatus.COMMAND_REJECTED);
        verify(auditService).record(eq("corr-t05-ack"), anyString(), eq("COMMAND_REJECTED"),
                anyString(), anyString(), eq("FAILED"), eq("TOKEN_REJECTED"), any());
    }

    @Test
    void ackDuplicate_transitionneLaRechargeVersCreditApplied() {
        // Bug réel découvert sous charge légère (T14) : un ACK DUPLICATE (le dongle a détecté un
        // rejeu de ce commandId, via son propre mécanisme anti-rejeu) signifie que le token a
        // nécessairement déjà été appliqué avec succès lors d'une tentative antérieure -- avant
        // ce correctif, ce cas tombait dans le "default" du switch (simple log.warn) et laissait
        // la recharge bloquée indéfiniment malgré un crédit réellement appliqué côté compteur.
        UUID rechargeId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();

        Recharge recharge = new Recharge(UUID.randomUUID(), "CIE-LAB-0001", "CUST-1",
                new BigDecimal("1000"), "KEY-T14-DUP", "corr-t14-dup");
        MeterCommand command = new MeterCommand(rechargeId, "DONGLE-LAB-0001", "corr-t14-dup", "hash",
                1L, Instant.now().plusSeconds(60));

        when(commandRepository.findById(commandId)).thenReturn(Optional.of(command));
        when(rechargeRepository.findById(any())).thenReturn(Optional.of(recharge));

        orchestrator.handleAck(commandId, CommandStatus.DUPLICATE, "corr-t14-dup-retry");

        assertThat(command.getStatus()).isEqualTo(CommandStatus.DUPLICATE);
        assertThat(recharge.getStatus()).isEqualTo(RechargeStatus.CREDIT_APPLIED);
        verify(auditService).record(eq("corr-t14-dup-retry"), anyString(), eq("CREDIT_APPLIED_VIA_DUPLICATE_ACK"),
                anyString(), anyString(), eq("SUCCESS"), any(), anyString());
    }

    @Test
    void ackTimeout_republieAvecUneFenetreRenouveleeEtPasseRechargeEnCommandTimeout() {
        // T07: un ACK TIMEOUT (déclenché soit par un ACK tardif, soit par
        // CommandExpiryWatcher) doit relancer la commande avec un expiresAt frais
        // (l'ancien est par définition déjà dépassé) plutôt que de la republier
        // hors-fenêtre, et laisser la recharge en COMMAND_TIMEOUT (pas bloquée).
        UUID rechargeId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();
        Instant staleExpiry = Instant.now().minusSeconds(5);

        Recharge recharge = new Recharge(UUID.randomUUID(), "CIE-LAB-0001", "CUST-1",
                new BigDecimal("2000"), "KEY-T07", "corr-t07");
        MeterCommand command = new MeterCommand(rechargeId, "DONGLE-LAB-0001", "corr-t07", "hash", 1L, staleExpiry);

        when(commandRepository.findById(commandId)).thenReturn(Optional.of(command));
        when(rechargeRepository.findById(any())).thenReturn(Optional.of(recharge));
        ArgumentCaptor<Instant> expiryCaptor = ArgumentCaptor.forClass(Instant.class);

        orchestrator.handleAck(commandId, CommandStatus.TIMEOUT, "corr-t07-watcher");

        assertThat(command.getRetryCount()).isEqualTo(1);
        assertThat(recharge.getStatus()).isEqualTo(RechargeStatus.COMMAND_TIMEOUT);
        verify(commandPublisher).publishTokenCommand(anyString(), any(), anyString(), anyString(), anyLong(),
                expiryCaptor.capture(), any(BigDecimal.class));
        assertThat(expiryCaptor.getValue()).isAfter(Instant.now());
    }

    @Test
    void ackTimeoutApresMaxRetries_basculeEnFallback() {
        // T07: après épuisement des tentatives, plus de republication -> fallback
        // token visible (ALG-02 étape 8), la recharge ne doit jamais rester bloquée.
        UUID rechargeId = UUID.randomUUID();
        UUID commandId = UUID.randomUUID();

        Recharge recharge = new Recharge(UUID.randomUUID(), "CIE-LAB-0001", "CUST-1",
                new BigDecimal("2000"), "KEY-T07-MAX", "corr-t07-max");
        MeterCommand command = new MeterCommand(rechargeId, "DONGLE-LAB-0001", "corr-t07-max", "hash", 1L,
                Instant.now().minusSeconds(5));
        command.incrementRetry();
        command.incrementRetry();
        command.incrementRetry(); // retryCount == MAX_RETRIES (3)

        when(commandRepository.findById(commandId)).thenReturn(Optional.of(command));
        when(rechargeRepository.findById(any())).thenReturn(Optional.of(recharge));

        orchestrator.handleAck(commandId, CommandStatus.TIMEOUT, "corr-t07-max-watcher");

        assertThat(recharge.getStatus()).isEqualTo(RechargeStatus.FALLBACK_TOKEN_SENT);
        verify(commandPublisher, never()).publishTokenCommand(anyString(), any(), anyString(), anyString(),
                anyLong(), any(Instant.class), any(BigDecimal.class));
    }

    private static long anyLong() {
        return org.mockito.ArgumentMatchers.anyLong();
    }

    private static String eq(String value) {
        return org.mockito.ArgumentMatchers.eq(value);
    }
}
