package ci.cie.smartprepaid.recharge.service;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Reporte la publication MQTT d'une commande à après le commit de la
 * transaction qui a persisté la ligne `command`. Sans cela, le dongle peut
 * renvoyer son ACK en quelques millisecondes (mock-dongle en local), plus
 * vite que le commit Postgres, et l'AckListener échoue à corréler l'ACK
 * ("Commande inconnue") car la commande n'est pas encore visible dans une
 * nouvelle transaction. Le travail réel est délégué à {@link CommandSendFinalizer}
 * (bean distinct, cf. sa Javadoc pour pourquoi).
 */
@Component
public class CommandDispatcher {

    private final CommandSendFinalizer finalizer;

    public CommandDispatcher(CommandSendFinalizer finalizer) {
        this.finalizer = finalizer;
    }

    public void dispatchAfterCommit(UUID commandId, UUID rechargeId, String deviceId, String correlationId,
                                     String tokenPlaintext, long sequence, Instant expiresAt, BigDecimal amountXof) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    finalizer.publishAndMarkSent(commandId, rechargeId, deviceId, correlationId, tokenPlaintext,
                            sequence, expiresAt, amountXof);
                }
            });
        } else {
            finalizer.publishAndMarkSent(commandId, rechargeId, deviceId, correlationId, tokenPlaintext,
                    sequence, expiresAt, amountXof);
        }
    }
}
