package ci.cie.smartprepaid.recharge.service;

import ci.cie.smartprepaid.audit.service.AuditService;
import ci.cie.smartprepaid.mqtt.CommandPublisher;
import ci.cie.smartprepaid.recharge.domain.CommandStatus;
import ci.cie.smartprepaid.recharge.domain.RechargeStatus;
import ci.cie.smartprepaid.recharge.repo.CommandRepository;
import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Bean séparé de {@link CommandDispatcher} pour que {@code publishAndMarkSent}
 * passe bien par le proxy Spring (pas d'auto-invocation) et que
 * {@code REQUIRES_NEW} force une transaction neuve. Nécessaire car cette
 * méthode est appelée depuis un callback {@code TransactionSynchronization
 * #afterCommit()} : à ce stade, la transaction déclenchante est déjà commitée
 * au niveau base, mais ses ressources ne sont pas encore débindées du thread —
 * tout travail fait avec une propagation par défaut (REQUIRED) s'y "raccroche"
 * silencieusement et n'est jamais recommité (observé: audit COMMAND_SENT créé
 * en mémoire, jamais visible en base).
 */
@Component
public class CommandSendFinalizer {

    private final CommandPublisher commandPublisher;
    private final CommandRepository commandRepository;
    private final RechargeRepository rechargeRepository;
    private final AuditService auditService;

    public CommandSendFinalizer(CommandPublisher commandPublisher, CommandRepository commandRepository,
                                 RechargeRepository rechargeRepository, AuditService auditService) {
        this.commandPublisher = commandPublisher;
        this.commandRepository = commandRepository;
        this.rechargeRepository = rechargeRepository;
        this.auditService = auditService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void publishAndMarkSent(UUID commandId, UUID rechargeId, String deviceId, String correlationId,
                                    String tokenPlaintext, long sequence, Instant expiresAt, BigDecimal amountXof) {
        commandPublisher.publishTokenCommand(deviceId, commandId, correlationId, tokenPlaintext, sequence,
                expiresAt, amountXof);

        // Le dongle peut ACKer en quelques millisecondes, avant même que cette méthode n'ait
        // fini de s'exécuter : UPDATE conditionnel ATOMIQUE (pas de find() + check en mémoire +
        // save(), qui perdrait silencieusement un ACCEPTED déjà committé entre-temps par
        // handleAck() -- "lost update" réel découvert sous charge légère, voir la Javadoc de
        // CommandRepository#markSentIfStatus). Ne fait rien si le statut n'est déjà plus PENDING
        // (0 ligne affectée) : l'ACK est passé en premier, sa version de l'état fait foi.
        commandRepository.markSentIfStatus(commandId, CommandStatus.PENDING, CommandStatus.SENT, Instant.now());
        rechargeRepository.markStatusIfStatus(rechargeId, RechargeStatus.TOKEN_GENERATED,
                RechargeStatus.COMMAND_SENT, Instant.now());
        auditService.record(correlationId, "recharge-orchestrator", "COMMAND_SENT", "COMMAND",
                commandId.toString(), "SENT", null,
                "deviceId=%s sequence=%d".formatted(deviceId, sequence));
    }
}
