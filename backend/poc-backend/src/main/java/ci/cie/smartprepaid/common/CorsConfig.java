package ci.cie.smartprepaid.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Autorise le serveur de dev Vite du frontend (frontend/, port 5173 par défaut)
 * à appeler l'API locale pendant le développement. Actif uniquement sous le
 * profil Spring "dev" (voir docker-compose.yml, SPRING_PROFILES_ACTIVE=dev) —
 * jamais activé par défaut, donc jamais présent hors d'un poste de dev local.
 *
 * Expose un {@link CorsConfigurationSource} (et non un {@code WebMvcConfigurer})
 * car Spring Security intercepte désormais les requêtes avant le MVC : c'est la
 * chaîne de filtres Security (voir customer.security.SecurityConfig) qui doit
 * appliquer le CORS, sinon les endpoints protégés par JWT le contourneraient.
 */
@Configuration
@Profile("dev")
public class CorsConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:5173"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of(CorrelationIdFilter.HEADER));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/v1/**", configuration);
        return source;
    }
}
