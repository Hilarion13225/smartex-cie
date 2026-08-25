package ci.cie.smartprepaid.customer.service;

/**
 * Abstraction du canal d'envoi OTP. Deux implémentations disponibles, choisies via
 * {@code otp.sender} (voir application.yml, défaut "console" -- jamais "brevo" sans
 * OTP_SENDER=brevo explicite) :
 * <ul>
 *   <li>{@link ConsoleOtpSender} (défaut) : mock/log, pas d'envoi réel.</li>
 *   <li>{@link BrevoOtpSender} : envoi réel par email via l'API Brevo.</li>
 * </ul>
 * {@code email} peut être null (compte sans email, ex. antérieur à cette fonctionnalité) --
 * à une implémentation de décider comment réagir (BrevoOtpSender lève une erreur claire,
 * n'ayant aucun autre canal disponible).
 */
public interface OtpSender {
    void send(String phoneNumber, String email, String code);
}
