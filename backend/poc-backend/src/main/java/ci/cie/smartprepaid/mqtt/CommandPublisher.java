package ci.cie.smartprepaid.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Publie une commande signée vers cie/lab/{deviceId}/command/token en QoS 1.
 * Retained désactivé pour les commandes d'activation (§10 MQTT).
 * IMPORTANT: le token circule dans le payload MQTT (chiffré par TLS transport),
 * mais ne doit JAMAIS apparaître dans un log applicatif (voir AuditService#maskToken).
 */
@Component
public class CommandPublisher {

    private static final Logger log = LoggerFactory.getLogger(CommandPublisher.class);

    private final MqttClientProvider clientProvider;
    private final MqttProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CommandPublisher(MqttClientProvider clientProvider, MqttProperties properties) {
        this.clientProvider = clientProvider;
        this.properties = properties;
    }

    public void publishTokenCommand(String deviceId, UUID commandId, String correlationId,
                                     String tokenPlaintext, long sequence, Instant expiresAt,
                                     java.math.BigDecimal amountXof) {
        String topic = "cie/lab/%s/command/token".formatted(deviceId);
        Map<String, Object> payload = Map.of(
                "commandId", commandId.toString(),
                "correlationId", correlationId,
                "token", tokenPlaintext,
                "sequence", sequence,
                "expiresAt", expiresAt.toString(),
                "amountXof", amountXof
        );
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(payload);
            MqttMessage message = new MqttMessage(bytes);
            message.setQos(properties.getQos());
            message.setRetained(false);
            clientProvider.client().publish(topic, message);
            // Ne JAMAIS logger `payload` tel quel: il contient le token en clair.
            log.info("Commande {} publiée sur {} (correlationId={})", commandId, topic, correlationId);
        } catch (Exception e) {
            log.error("Échec de publication MQTT pour commandId={}: {}", commandId, e.getMessage());
            throw new IllegalStateException("Échec de publication MQTT", e);
        }
    }
}
