package ci.cie.smartprepaid.customer.service;

import ci.cie.smartprepaid.common.DomainException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Envoi réel du code OTP par email via l'API transactionnelle Brevo
 * (https://api.brevo.com/v3/smtp/email). Actif seulement si {@code otp.sender=brevo}
 * (voir application.yml, OTP_SENDER) -- {@link ConsoleOtpSender} reste le défaut.
 *
 * Le token/mot de passe ne sont jamais concernés ici : uniquement le code OTP, dont
 * l'envoi en clair par un canal choisi est la fonction même de cette classe (contrairement
 * au masquage strict du token compteur, RG-C-005).
 */
@Component
@ConditionalOnProperty(name = "otp.sender", havingValue = "brevo")
public class BrevoOtpSender implements OtpSender {

    private static final Logger log = LoggerFactory.getLogger(BrevoOtpSender.class);
    private static final URI BREVO_ENDPOINT = URI.create("https://api.brevo.com/v3/smtp/email");

    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String senderEmail;
    private final String senderName;

    public BrevoOtpSender(ObjectMapper objectMapper,
                           @Value("${brevo.api-key}") String apiKey,
                           @Value("${brevo.sender-email}") String senderEmail,
                           @Value("${brevo.sender-name:CIE Smart Prepaid}") String senderName) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.senderEmail = senderEmail;
        this.senderName = senderName;
    }

    @Override
    public void send(String phoneNumber, String email, String code) {
        if (email == null || email.isBlank()) {
            // Pas de repli silencieux sur un autre canal : ce compte n'a aucun email
            // enregistré, l'utilisateur doit le savoir plutôt que de rester bloqué sans
            // explication sur l'écran de vérification.
            throw new DomainException("VALIDATION",
                    "Aucun email associé à ce compte : impossible d'envoyer le code de vérification");
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("sender", Map.of("email", senderEmail, "name", senderName));
            body.put("to", List.of(Map.of("email", email)));
            body.put("subject", "Votre code de vérification CIE Smart Prepaid");
            body.put("htmlContent", "<p>Votre code de vérification est : <b>" + code + "</b></p>"
                    + "<p>Ce code expire dans quelques minutes et ne doit être communiqué à personne.</p>");

            HttpRequest request = HttpRequest.newBuilder(BREVO_ENDPOINT)
                    .header("api-key", apiKey)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                log.error("Échec envoi OTP par email via Brevo (HTTP {}) pour {} : {}",
                        response.statusCode(), phoneNumber, response.body());
                throw new DomainException("VALIDATION", "Échec de l'envoi du code de vérification par email");
            }
            log.info("Code OTP envoyé par email via Brevo pour {} ({})", phoneNumber, email);
        } catch (DomainException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur réseau/inattendue lors de l'envoi OTP par email via Brevo pour {}", phoneNumber, e);
            throw new DomainException("VALIDATION", "Échec de l'envoi du code de vérification par email");
        }
    }
}
