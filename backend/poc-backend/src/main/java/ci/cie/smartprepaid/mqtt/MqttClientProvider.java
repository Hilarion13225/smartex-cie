package ci.cie.smartprepaid.mqtt;

import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Fournit un unique MqttClient partagé par CommandPublisher et AckListener.
 * TLS mutuel + ACL par device sont de la responsabilité du broker en
 * environnement labo/pré-prod (voir §12 Securite) — ici, on se connecte avec
 * les identifiants du gateway backend, pas ceux d'un dongle individuel.
 */
@Component
public class MqttClientProvider {

    private static final Logger log = LoggerFactory.getLogger(MqttClientProvider.class);

    private final MqttProperties properties;
    private MqttClient client;

    public MqttClientProvider(MqttProperties properties) {
        this.properties = properties;
    }

    public synchronized MqttClient client() {
        if (client == null || !client.isConnected()) {
            try {
                client = new MqttClient(properties.getBrokerUrl(), properties.getClientId(), new MemoryPersistence());
                MqttConnectOptions options = new MqttConnectOptions();
                options.setAutomaticReconnect(true);
                options.setCleanSession(false);
                if (properties.getUsername() != null) {
                    options.setUserName(properties.getUsername());
                    options.setPassword(properties.getPassword().toCharArray());
                }
                client.connect(options);
                log.info("Connecté au broker MQTT {}", properties.getBrokerUrl());
            } catch (Exception e) {
                log.error("Connexion MQTT impossible: {}", e.getMessage());
                throw new IllegalStateException("Connexion MQTT impossible", e);
            }
        }
        return client;
    }

    @PreDestroy
    public void shutdown() {
        try {
            if (client != null && client.isConnected()) {
                client.disconnect();
            }
        } catch (Exception ignored) {
        }
    }
}
