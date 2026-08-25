package ci.cie.smartprepaid.customer.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Implémentation PoC de {@link OtpSender} : "envoie" le code en le loggant en
 * clair sur la console du backend, pour que le testeur de labo puisse le lire
 * et le saisir manuellement. Contrairement au token compteur (RG-C-005), le
 * code OTP n'est PAS soumis à la règle "jamais en clair dans les logs" — c'est
 * précisément le canal de livraison choisi tant qu'aucun fournisseur réel
 * n'est configuré (voir otp.sender, défaut "console" -- {@link BrevoOtpSender}
 * pour un envoi réel par email).
 */
@Component
@ConditionalOnProperty(name = "otp.sender", havingValue = "console", matchIfMissing = true)
public class ConsoleOtpSender implements OtpSender {

    private static final Logger log = LoggerFactory.getLogger(ConsoleOtpSender.class);

    @Override
    public void send(String phoneNumber, String email, String code) {
        log.info("[OTP-MOCK] Code de vérification pour {} ({}) : {} (aucun envoi réel — PoC)",
                phoneNumber, email != null ? email : "aucun email", code);
    }
}
