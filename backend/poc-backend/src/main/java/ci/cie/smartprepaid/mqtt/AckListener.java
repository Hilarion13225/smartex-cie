package ci.cie.smartprepaid.mqtt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ci.cie.smartprepaid.recharge.domain.CommandStatus;
import ci.cie.smartprepaid.recharge.service.RechargeOrchestrator;
import jakarta.annotation.PostConstruct;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * S'abonne à cie/lab/+/ack et corrèle chaque ACK à sa commande via commandId
 * (§10 MQTT, §11 DB command.ack_at). Un ACK technique (livraison MQTT) est
 * distinct d'un ACK métier (compteur ACCEPTED/REJECTED) — ici on modélise
 * directement l'ACK métier renvoyé par le mock-dongle, l'ACK technique QoS1
 * étant géré nativement par Paho.
 */
@Component
public class AckListener implements MqttCallback {

    private static final Logger log = LoggerFactory.getLogger(AckListener.class);
    private static final String ACK_TOPIC_FILTER = "cie/lab/+/ack";

    private final MqttClientProvider clientProvider;
    private final MqttProperties properties;
    private final RechargeOrchestrator rechargeOrchestrator;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AckListener(MqttClientProvider clientProvider, MqttProperties properties,
                        RechargeOrchestrator rechargeOrchestrator) {
        this.clientProvider = clientProvider;
        this.properties = properties;
        this.rechargeOrchestrator = rechargeOrchestrator;
    }

    @PostConstruct
    public void subscribe() {
        try {
            var client = clientProvider.client();
            client.setCallback(this);
            client.subscribe(ACK_TOPIC_FILTER, properties.getQos());
            log.info("Abonné à {}", ACK_TOPIC_FILTER);
        } catch (Exception e) {
            log.error("Abonnement MQTT ACK impossible: {}", e.getMessage());
        }
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) {
        try {
            JsonNode node = objectMapper.readTree(message.getPayload());
            UUID commandId = UUID.fromString(node.get("commandId").asText());
            String correlationId = node.hasNonNull("correlationId") ? node.get("correlationId").asText() : "n/a";
            CommandStatus status = CommandStatus.valueOf(node.get("result").asText());
            rechargeOrchestrator.handleAck(commandId, status, correlationId);
        } catch (Exception e) {
            log.error("ACK MQTT illisible sur {}: {}", topic, e.getMessage());
        }
    }

    @Override
    public void connectionLost(Throwable cause) {
        log.warn("Connexion MQTT perdue: {}", cause.getMessage());
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {
        // no-op: on suit l'ACK métier, pas seulement la livraison QoS1.
    }
}
