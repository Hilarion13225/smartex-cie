package ci.cie.smartprepaid.recharge.service;

import ci.cie.smartprepaid.audit.service.AuditService;
import ci.cie.smartprepaid.device.domain.Device;
import ci.cie.smartprepaid.device.service.DeviceService;
import ci.cie.smartprepaid.mqtt.CommandPublisher;
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
    private final CommandPublisher commandPublisher;
    private final AuditService auditService;
    private final long commandTtlSeconds;

    public RechargeOrchestrator(RechargeRepository rechargeRepository, CommandRepository commandRepository,
                                 DeviceService deviceService, CommandPublisher commandPublisher,
                                 AuditService auditService,
                                 ci.cie.smartprepaid.mqtt.MqttProperties mqttProperties) {
        this.rechargeRepository = rechargeRepository;
        this.commandRepository = commandRepository;
        this.deviceService = deviceService;
        this.commandPublisher = commandPublisher;
        this.auditService = auditService;
        this.commandTtlSeconds = mqttProperties.getCommandTtlSeconds();
    }

    /** ALG-02 étapes 1-9, déclenché automatiquement depuis PaymentService après confirmation. */
    @Transactional
    public Recharge startFromConfirmedPayment(Payment payment, String correlationId) {
        String idempotencyKey = buildIdempotencyKey(payment.getProvider(), payment.getProviderTxId(),
                payment.getMeterId(), payment.getAmountXof());
        return orchestrate(payment.getPaymentId(), payment.getMeterId(), payment.getCustomerId(),
                payment.getAmountXof(), idempotencyKey, correlationId);
    }

    /** Recharge manuelle initiée via POST /api/v1/recharges (client fournit idempotencyKey). */
    @Transactional
    public Recharge startManual(UUID paymentId, String meterId, String customerId,
                                 java.math.BigDecimal amountXof, String idempotencyKey, String correlationId) {
        return orchestrate(paymentId, meterId, customerId, amountXof, idempotencyKey, correlationId);
    }

    private Recharge orchestrate(UUID paymentId, String meterId, String customerId,
                                  java.math.BigDecimal amountXof, String idempotencyKey, String correlationId) {
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
        String tokenPlaintext = generateTokenPlaceholder(meterId, amountXof);
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

        // ALG-02 étape 6 (suite): pousser la commande au dongle via MQTT.
        commandPublisher.publishTokenCommand(device.getDeviceId(), command.getCommandId(), correlationId,
                tokenPlaintext, nextSequence, expiresAt, recharge.getAmountXof());
        command.markSent();
        commandRepository.save(command);

        recharge.transitionTo(RechargeStatus.COMMAND_SENT);
        rechargeRepository.save(recharge);
        auditService.record(correlationId, "recharge-orchestrator", "COMMAND_SENT", "COMMAND",
                command.getCommandId().toString(), "SENT", null,
                "deviceId=%s sequence=%d".formatted(device.getDeviceId(), nextSequence));

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
            case TIMEOUT -> handleTimeout(command, recharge, correlationId);
            default -> log.warn("ACK non géré: {} pour commande {}", ackResult, commandId);
        }
        rechargeRepository.save(recharge);
    }

    private void handleTimeout(MeterCommand command, Recharge recharge, String correlationId) {
        if (command.getRetryCount() < MAX_RETRIES) {
            command.incrementRetry();
            commandRepository.save(command);
            commandPublisher.publishTokenCommand(command.getDeviceId(), command.getCommandId(), correlationId,
                    "[retry-no-plaintext-stored]", command.getSequence(), command.getExpiresAt(),
                    recharge.getAmountXof());
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
        commandPublisher.publishTokenCommand(command.getDeviceId(), command.getCommandId(), correlationId,
                "[retry-manuel-no-plaintext-stored]", command.getSequence(), newExpiry, recharge.getAmountXof());
        commandRepository.save(command);
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
}
