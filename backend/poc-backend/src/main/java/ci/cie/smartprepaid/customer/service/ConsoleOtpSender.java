package ci.cie.smartprepaid.customer.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Implémentation PoC de {@link OtpSender} : "envoie" le code en le loggant en
 * clair sur la console du backend, pour que le testeur de labo puisse le lire
 * et le saisir manuellement. Contrairement au token compteur (RG-C-005), le
 * code OTP n'est PAS soumis à la règle "jamais en clair dans les logs" — c'est
 * précisément le canal de livraison choisi tant qu'aucun fournisseur SMS réel
 * n'est intégré. À remplacer par un vrai provider SMS avant tout usage réel.
 */
@Component
public class ConsoleOtpSender implements OtpSender {

    private static final Logger log = LoggerFactory.getLogger(ConsoleOtpSender.class);

    @Override
    public void send(String phoneNumber, String code) {
        log.info("[OTP-MOCK] Code de vérification pour {} : {} (aucun SMS réel envoyé — PoC)",
                phoneNumber, code);
    }
}
