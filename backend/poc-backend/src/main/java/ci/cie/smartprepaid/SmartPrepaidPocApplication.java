package ci.cie.smartprepaid;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Backend PoC Laboratoire - CIE Smart Retrofit Metering.
 *
 * Regroupe, pour la phase PoC, les domaines Payment / Recharge (Token+Command) /
 * Device / Audit / Meter-Adapter / MQTT Gateway dans un seul déployable Spring Boot.
 * Chaque domaine est isolé dans son propre package pour pouvoir être extrait en
 * microservice indépendant lors du passage à l'architecture V2, sans réécriture du
 * cœur métier (voir /docs/03_architecture-v2-classeur.md, sections JAVA_SPEC).
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class SmartPrepaidPocApplication {
    public static void main(String[] args) {
        SpringApplication.run(SmartPrepaidPocApplication.class, args);
    }
}
