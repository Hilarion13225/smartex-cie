package ci.cie.smartprepaid.mqtt;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "mqtt")
public class MqttProperties {

    /** ex: tcp://mosquitto:1883 (TLS via ssl:// en environnement non-lab) */
    private String brokerUrl = "tcp://localhost:1883";
    private String clientId = "poc-backend-gateway";
    private String username;
    private String password;
    /** fenêtre de validité d'une commande avant expiration (T13). */
    private long commandTtlSeconds = 60;
    private int qos = 1;

    public String getBrokerUrl() { return brokerUrl; }
    public void setBrokerUrl(String brokerUrl) { this.brokerUrl = brokerUrl; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public long getCommandTtlSeconds() { return commandTtlSeconds; }
    public void setCommandTtlSeconds(long commandTtlSeconds) { this.commandTtlSeconds = commandTtlSeconds; }
    public int getQos() { return qos; }
    public void setQos(int qos) { this.qos = qos; }
}
