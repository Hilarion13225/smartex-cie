package ci.cie.smartprepaid.recharge.service;

import ci.cie.smartprepaid.audit.service.AuditService;
import ci.cie.smartprepaid.device.domain.Device;
import ci.cie.smartprepaid.device.service.DeviceService;
import ci.cie.smartprepaid.payment.domain.Payment;
import ci.cie.smartprepaid.recharge.domain.CommandStatus;
import ci.cie.smartprepaid.recharge.domain.MeterCommand;
import ci.cie.smartprepaid.recharge.domain.Recharge;
import ci.cie.smartprepaid.recharge.domain.RechargeStatus;
import ci.cie.smartprepaid.recharge.repo.CommandRepository;
import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Cœur du PoC: implémentation Java de ALG-02 (Recharge automatique avec
 * idempotence) et de ALG-05 partiellement (côté fallback -> incident implicite).
 * Toute méthode publique doit rester idempotente vis-à-vis d'un rejeu du même
 * événement (paiement dupliqué, ACK dupliqué, retry manuel) — tests T06/T12.
 */
@Service
public class RechargeOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(RechargeOrchestrator.class);
    private static final int MAX_RETRIES = 3;

    private final RechargeRepository rechargeRepository;
    private final CommandRepository commandRepository;
    private final DeviceService deviceService;
    private final CommandDispatcher commandDispatcher;
    private final AuditService auditService;
    private final long commandTtlSeconds;

    public RechargeOrchestrator(RechargeRepository rechargeRepository, CommandRepository commandRepository,
                                 DeviceService deviceService, CommandDispatcher commandDispatcher,
                                 AuditService auditService, ci.cie.smartprepaid.mqtt.MqttProperties mqttProperties) {
        this.rechargeRepository = rechargeRepository;
        this.commandRepository = commandRepository;
        this.deviceService = deviceService;
        this.commandDispatcher = commandDispatcher;
        this.auditService = auditService;
        this.commandTtlSeconds = mqttProperties.getCommandTtlSeconds();
    }

    /** ALG-02 étapes 1-9, déclenché automatiquement depuis PaymentService après confirmation. */
    @Transactional
    public Recharge startFromConfirmedPayment(Payment payment, String correlationId) {
        String idempotencyKey = buildIdempotencyKey(payment.getProvider(), payment.getProviderTxId(),
                payment.getMeterId(), payment.getAmountXof());
        return orchestrate(payment.getPaymentId(), payment.getMeterId(), payment.getCustomerId(),
                payment.getAmountXof(), idempotencyKey, correlationId, false);
    }

    /**
     * Recharge manuelle initiée via POST /api/v1/recharges (client fournit idempotencyKey).
     * `forceInvalidToken`: endpoint de recette T05 (token invalide -> REJECTED, voir
     * README §T05) — force un token contenant le marqueur INVALID reconnu par le
     * mock-dongle. Toujours `false` depuis le flux nominal (paiement confirmé).
     */
    @Transactional
    public Recharge startManual(UUID paymentId, String meterId, String customerId,
                                 java.math.BigDecimal amountXof, String idempotencyKey, String correlationId,
                                 boolean forceInvalidToken) {
        return orchestrate(paymentId, meterId, customerId, amountXof, idempotencyKey, correlationId,
                forceInvalidToken);
    }

    private Recharge orchestrate(UUID paymentId, String meterId, String customerId,
                                  java.math.BigDecimal amountXof, String idempotencyKey, String correlationId,
                                  boolean forceInvalidToken) {
        // ALG-02 étape 3: idempotency_key déjà traitée -> retourner l'existant sans recréer.
        var existing = rechargeRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            auditService.record(correlationId, "recharge-orchestrator", "RECHARGE_IDEMPOTENT_REPLAY",
                    "RECHARGE", existing.get().getRechargeId().toString(), "IGNORED", null,
                    "idempotencyKey déjà traitée: " + idempotencyKey);
            return existing.get();
        }

        Recharge recharge = new Recharge(paymentId, meterId, customerId, amountXof, idempotencyKey, correlationId);
        recharge = rechargeRepository.save(recharge);
        auditService.record(correlationId, "recharge-orchestrator", "RECHARGE_CREATED", "RECHARGE",
                recharge.getRechargeId().toString(), "CREATED", null, "meterId=" + meterId);

        // ALG-02 étape 4: vérifier l'association customer/meter -> device.
        Device device;
        try {
            device = deviceService.findByMeterIdOrThrow(meterId);
        } catch (Exception e) {
            recharge.transitionTo(RechargeStatus.FALLBACK_TOKEN_SENT);
            rechargeRepository.save(recharge);
            auditService.record(correlationId, "recharge-orchestrator", "RECHARGE_NO_DEVICE_FALLBACK",
                    "RECHARGE", recharge.getRechargeId().toString(), "FALLBACK", "METER_NOT_ELIGIBLE",
                    "Aucun device associé, bascule sur fallback token visible (RG-C-005)");
            return recharge;
        }

        // ALG-02 étapes 5-6: génération token + création de la commande (séquence monotone).
        String tokenPlaintext = forceInvalidToken
                ? generateInvalidTokenPlaceholder(meterId)
                : generateTokenPlaceholder(meterId, amountXof);
        recharge.attachTokenHash(TokenHasher.sha256(tokenPlaintext));
        recharge.transitionTo(RechargeStatus.TOKEN_GENERATED);
        rechargeRepository.save(recharge);

        long nextSequence = commandRepository.findTopByDeviceIdOrderBySequenceDesc(device.getDeviceId())
                .map(c -> c.getSequence() + 1)
                .orElse(1L);
        Instant expiresAt = Instant.now().plusSeconds(commandTtlSeconds);
        MeterCommand command = new MeterCommand(recharge.getRechargeId(), device.getDeviceId(), correlationId,
                TokenHasher.sha256(tokenPlaintext), nextSequence, expiresAt);
        command = commandRepository.save(command);

        // ALG-02 étape 6 (suite): pousser la commande au dongle via MQTT, mais
        // seulement après le commit (cf. CommandDispatcher) pour que la commande
        // soit visible en base avant qu'un ACK ne puisse revenir.
        commandDispatcher.dispatchAfterCommit(command.getCommandId(), recharge.getRechargeId(),
                device.getDeviceId(), correlationId, tokenPlaintext, nextSequence, expiresAt,
                recharge.getAmountXof());

        return recharge;
    }

    /**
     * ALG-02 étape 7: interprète l'ACK reçu du dongle (via AckListener/MQTT).
     * Idempotent: un ACK reçu deux fois pour la même commande terminale est ignoré (T06/T12).
     */
    @Transactional
    public void handleAck(UUID commandId, CommandStatus ackResult, String correlationId) {
        MeterCommand command = commandRepository.findById(commandId)
                .orElseThrow(() -> new IllegalArgumentException("Commande inconnue: " + commandId));

        if (isTerminal(command.getStatus())) {
            auditService.record(correlationId, "recharge-orchestrator", "ACK_DUPLICATE_IGNORED",
                    "COMMAND", commandId.toString(), "IGNORED", null,
                    "ACK reçu alors que la commande est déjà dans un état terminal: " + command.getStatus());
            return;
        }

        if (command.isExpired() && ackResult != CommandStatus.TIMEOUT) {
            // T13: commande hors fenêtre -> rejet, quel que soit l'ACK reçu.
            ackResult = CommandStatus.TIMEOUT;
        }

        command.markAcked(ackResult);
        commandRepository.save(command);

        Recharge recharge = rechargeRepository.findById(command.getRechargeId())
                .orElseThrow(() -> new IllegalStateException("Recharge introuvable pour commande " + commandId));

        switch (ackResult) {
            case ACCEPTED -> {
                recharge.transitionTo(RechargeStatus.CREDIT_APPLIED);
                auditService.record(correlationId, "recharge-orchestrator", "CREDIT_APPLIED", "RECHARGE",
                        recharge.getRechargeId().toString(), "SUCCESS", null, null);
            }
            case REJECTED -> {
                recharge.transitionTo(RechargeStatus.COMMAND_REJECTED);
                auditService.record(correlationId, "recharge-orchestrator", "COMMAND_REJECTED", "RECHARGE",
                        recharge.getRechargeId().toString(), "FAILED", "TOKEN_REJECTED", null);
            }
            case DUPLICATE -> {
                // Le dongle a détecté un rejeu de ce commandId (son propre mécanisme anti-rejeu,
                // voir mock-dongle) : le token a NÉCESSAIREMENT déjà été appliqué avec succès lors
                // d'une tentative antérieure (le dongle n'accepte/n'applique un token qu'une seule
                // fois par commandId) -- ce backend ne l'avait simplement pas su à temps (ACK
                // initial gagné par une course puis écrasé par CommandSendFinalizer, cf. sa
                // Javadoc). Sans ce cas, la recharge restait bloquée indéfiniment en
                // COMMAND_TIMEOUT malgré un crédit réellement appliqué côté compteur -- bug réel
                // découvert sous charge légère (T14), pas seulement théorique.
                recharge.transitionTo(RechargeStatus.CREDIT_APPLIED);
                auditService.record(correlationId, "recharge-orchestrator", "CREDIT_APPLIED_VIA_DUPLICATE_ACK",
                        "RECHARGE", recharge.getRechargeId().toString(), "SUCCESS", null,
                        "ACK DUPLICATE reçu du dongle : le token avait déjà été appliqué avec succès "
                                + "lors d'une tentative antérieure");
            }
            case TIMEOUT -> handleTimeout(command, recharge, correlationId);
            default -> log.warn("ACK non géré: {} pour commande {}", ackResult, commandId);
        }
        rechargeRepository.save(recharge);
    }

    private void handleTimeout(MeterCommand command, Recharge recharge, String correlationId) {
        if (command.getRetryCount() < MAX_RETRIES) {
            command.incrementRetry();
            // Renouvelle la fenêtre de validité : l'ancienne est par définition déjà
            // dépassée (c'est ce qui a déclenché ce TIMEOUT), la republier telle
            // quelle serait immédiatement hors-fenêtre côté dongle (T13).
            Instant newExpiresAt = Instant.now().plusSeconds(commandTtlSeconds);
            command.renewExpiry(newExpiresAt);
            commandRepository.save(command);
            // Publication différée à après le commit (cf. CommandDispatcher), pour la
            // même raison que l'envoi initial : éviter qu'un ACK ne revienne avant que
            // ce retry ne soit visible en base pour AckListener.
            commandDispatcher.dispatchAfterCommit(command.getCommandId(), recharge.getRechargeId(),
                    command.getDeviceId(), correlationId, "[retry-no-plaintext-stored]", command.getSequence(),
                    newExpiresAt, recharge.getAmountXof());
            recharge.transitionTo(RechargeStatus.COMMAND_TIMEOUT);
            auditService.record(correlationId, "recharge-orchestrator", "COMMAND_RETRY", "COMMAND",
                    command.getCommandId().toString(), "RETRY", null,
                    "retryCount=" + command.getRetryCount());
        } else {
            // ALG-02 étape 8: échec définitif -> fallback token visible + incident L2.
            recharge.transitionTo(RechargeStatus.FALLBACK_TOKEN_SENT);
            auditService.record(correlationId, "recharge-orchestrator", "RECHARGE_FALLBACK_AFTER_RETRIES",
                    "RECHARGE", recharge.getRechargeId().toString(), "FALLBACK", "RETRIES_EXHAUSTED",
                    "Bascule fallback après " + MAX_RETRIES + " tentatives (RG-C-005 / incident L2 à créer)");
        }
    }

    /** POST /api/v1/commands/{id}/retry: relance manuelle par un opérateur support/L2. */
    @Transactional
    public MeterCommand retryCommand(UUID commandId, String operatorId, String correlationId) {
        MeterCommand command = commandRepository.findById(commandId)
                .orElseThrow(() -> new ci.cie.smartprepaid.common.DomainException("NOT_FOUND",
                        "Commande introuvable: " + commandId));
        if (isTerminal(command.getStatus()) && command.getStatus() == CommandStatus.ACCEPTED) {
            throw new ci.cie.smartprepaid.common.DomainException("VALIDATION",
                    "Commande déjà acceptée, retry refusé: " + commandId);
        }
        Recharge recharge = rechargeRepository.findById(command.getRechargeId())
                .orElseThrow(() -> new ci.cie.smartprepaid.common.DomainException("NOT_FOUND",
                        "Recharge introuvable pour commande " + commandId));
        command.incrementRetry();
        Instant newExpiry = Instant.now().plusSeconds(commandTtlSeconds);
        command.renewExpiry(newExpiry);
        commandRepository.save(command);
        commandDispatcher.dispatchAfterCommit(command.getCommandId(), recharge.getRechargeId(),
                command.getDeviceId(), correlationId, "[retry-manuel-no-plaintext-stored]", command.getSequence(),
                newExpiry, recharge.getAmountXof());
        auditService.record(correlationId, "recharge-orchestrator", "COMMAND_RETRY_MANUAL", "COMMAND",
                commandId.toString(), "RETRY", null, "operatorId=" + operatorId);
        return command;
    }

    @Transactional(readOnly = true)
    public Recharge findRechargeOrThrow(UUID rechargeId) {
        return rechargeRepository.findById(rechargeId)
                .orElseThrow(() -> new ci.cie.smartprepaid.common.DomainException("NOT_FOUND",
                        "Recharge introuvable: " + rechargeId));
    }

    @Transactional(readOnly = true)
    public List<MeterCommand> findCommandsForRecharge(UUID rechargeId) {
        return commandRepository.findByRechargeIdOrderBySequenceAsc(rechargeId);
    }

    private boolean isTerminal(CommandStatus status) {
        return status == CommandStatus.ACCEPTED || status == CommandStatus.REJECTED
                || status == CommandStatus.DUPLICATE;
    }

    static String buildIdempotencyKey(String provider, String providerTxId, String meterId,
                                       java.math.BigDecimal amount) {
        return "%s|%s|%s|%s".formatted(provider, providerTxId, meterId, amount.stripTrailingZeros().toPlainString());
    }

    /** PoC uniquement: à remplacer par un appel réel au système de prépaiement/HSM (§ALG-02 étape 5). */
    private String generateTokenPlaceholder(String meterId, java.math.BigDecimal amount) {
        return "LABTKN-" + meterId + "-" + UUID.randomUUID();
    }

    /** T05 (recette): token portant le marqueur INVALID reconnu par le mock-dongle -> REJECTED. */
    private String generateInvalidTokenPlaceholder(String meterId) {
        return "LABTKN-INVALID-" + meterId + "-" + UUID.randomUUID();
    }
}
