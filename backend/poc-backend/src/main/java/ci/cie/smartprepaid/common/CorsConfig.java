package ci.cie.smartprepaid.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Autorise le serveur de dev Vite du frontend (frontend/, port 5173 par défaut)
 * à appeler l'API locale pendant le développement. Actif uniquement sous le
 * profil Spring "dev" (voir docker-compose.yml, SPRING_PROFILES_ACTIVE=dev) —
 * jamais activé par défaut, donc jamais présent hors d'un poste de dev local.
 */
@Configuration
@Profile("dev")
public class CorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/v1/**")
                        .allowedOrigins("http://localhost:5173")
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .exposedHeaders(CorrelationIdFilter.HEADER);
            }
        };
    }
}
