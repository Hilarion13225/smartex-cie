package ci.cie.smartprepaid.customer.service;

/**
 * Abstraction du canal d'envoi OTP (SMS en cible réelle — voir "Notification
 * Service" docs/03 §JAVA_SPEC/NODEJS_SPEC). Seule implémentation à ce stade :
 * {@link ConsoleOtpSender} (mock/log, pas d'intégration SMS réelle — PoC).
 */
public interface OtpSender {
    void send(String phoneNumber, String code);
}
