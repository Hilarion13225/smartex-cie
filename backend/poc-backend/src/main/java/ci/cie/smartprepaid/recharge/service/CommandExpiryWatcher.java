package ci.cie.smartprepaid.recharge.service;

import ci.cie.smartprepaid.recharge.domain.CommandStatus;
import ci.cie.smartprepaid.recharge.domain.MeterCommand;
import ci.cie.smartprepaid.recharge.repo.CommandRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * T07 (perte réseau/broker): sans ce job, une commande qui ne reçoit jamais
 * d'ACK (ex. dongle ou broker resté injoignable au-delà de la fenêtre
 * `expiresAt`) reste bloquée indéfiniment en PENDING/SENT — rien d'autre ne
 * la fait avancer, puisque handleAck() n'est déclenché que par un ACK MQTT
 * réellement reçu. Ce job détecte ces commandes en retard et les fait
 * transitionner en TIMEOUT (ALG-02 étape 7/8: retry borné puis fallback),
 * exactement comme si un ACK TIMEOUT tardif était arrivé.
 *
 * TIMEOUT est volontairement inclus, pas seulement PENDING/SENT : un retry
 * peut lui-même se perdre (ex. dongle pas encore réabonné au moment exact de
 * la republication après une coupure réseau, observé en test T07) ; sans
 * cela, la commande resterait bloquée en TIMEOUT après une seule tentative
 * au lieu d'épuiser ses MAX_RETRIES avant fallback.
 */
@Component
public class CommandExpiryWatcher {

    private static final Logger log = LoggerFactory.getLogger(CommandExpiryWatcher.class);
    private static final List<CommandStatus> NON_TERMINAL =
            List.of(CommandStatus.PENDING, CommandStatus.SENT, CommandStatus.TIMEOUT);

    private final CommandRepository commandRepository;
    private final RechargeOrchestrator orchestrator;

    public CommandExpiryWatcher(CommandRepository commandRepository, RechargeOrchestrator orchestrator) {
        this.commandRepository = commandRepository;
        this.orchestrator = orchestrator;
    }

    @Scheduled(fixedDelay = 10_000)
    public void expireOverdueCommands() {
        List<MeterCommand> overdue = commandRepository.findByStatusInAndExpiresAtBefore(NON_TERMINAL, Instant.now());
        for (MeterCommand command : overdue) {
            try {
                orchestrator.handleAck(command.getCommandId(), CommandStatus.TIMEOUT, command.getCorrelationId());
            } catch (Exception e) {
                log.error("Échec du traitement TIMEOUT pour commandId={}: {}", command.getCommandId(),
                        e.getMessage());
            }
        }
    }
}
