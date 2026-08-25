package ci.cie.smartprepaid.customer.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Matrice rôle × endpoint (voir aussi README §Authentification) :
 *
 * <pre>
 * Endpoint                                CLIENT   CIE_OPERATOR/CIE_ADMIN   DSI_ADMIN   Anonyme
 * /api/v1/auth/**                           -              -                   -          oui
 * /api/v1/meters/**                         -              -                   -          oui  (flux compteur/support)
 * /api/v1/payments/callback                 -              -                   -          oui  (webhook PSP)
 * /api/v1/devices/**                        -              -                   -          oui  (flux device/dongle)
 * /actuator/**                              -              -                   -          oui
 * /api/v1/customers/me                     soi-même        soi-même           soi-même     non
 * GET /api/v1/recharges/{id}         propriétaire only      toutes             toutes       non
 * POST /api/v1/recharges                   oui*             oui*               oui*         non
 * POST /api/v1/commands/{id}/retry          non             oui                non**        non
 * GET /api/v1/audit                         non             oui                oui          non
 * GET /api/v1/support/timeline              non             oui                oui          non
 * </pre>
 *
 * (*) POST /api/v1/recharges n'applique aucune vérification d'ownership du
 * {@code customerId} fourni dans le corps de la requête contre le JWT : c'est
 * une limite connue du PoC, documentée dans README §Authentification, hors
 * périmètre de ce correctif qui porte sur la lecture/les actions support.
 * (**) DSI_ADMIN est un rôle de supervision (lecture large), volontairement
 * exclu des actions opérationnelles comme le retry — seuls CIE_OPERATOR et
 * CIE_ADMIN peuvent relancer une commande.
 *
 * Pour /api/v1/recharges/{id}, la vérification d'ownership (recharge.customerId
 * == sujet du JWT) est faite via {@code @PreAuthorize} sur le contrôleur, avec
 * le bean réutilisable {@link ci.cie.smartprepaid.recharge.security.RechargeAuthorization}
 * — plutôt que dupliquer la logique dans chaque contrôleur nécessitant un contrôle
 * d'accès à la ressource.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {
                    // Source réelle fournie par common.CorsConfig, actif seulement en profil "dev".
                })
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers("/api/v1/meters/**").permitAll()
                        .requestMatchers("/api/v1/payments/callback").permitAll()
                        .requestMatchers("/api/v1/devices/**").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        // Nécessaire : quand un handler ci-dessous (401/403) appelle
                        // response.sendError(...), le conteneur redirige en interne vers
                        // /error pour le rendu (BasicErrorController). Cette deuxième
                        // requête interne ne repasse PAS par JwtAuthenticationFilter (les
                        // OncePerRequestFilter ignorent le dispatch ERROR par défaut) : sans
                        // ce permitAll, /error se retrouve elle-même refusée en anonyme et
                        // écrase le vrai statut (403 devient 401) — bug constaté et corrigé
                        // pendant la validation du correctif d'autorisation ci-dessous.
                        .requestMatchers("/error").permitAll()
                        // Vues support/audit : réservées aux rôles opérateur/admin CIE, pas
                        // une vue client typique et pas de filtrage par customerId pertinent
                        // sur ces deux endpoints (corrélation transverse par nature).
                        .requestMatchers("/api/v1/audit", "/api/v1/support/timeline")
                                .hasAnyRole("CIE_OPERATOR", "CIE_ADMIN", "DSI_ADMIN")
                        // Relance de commande : action support/opérateur, jamais une action client.
                        .requestMatchers("/api/v1/commands/*/retry")
                                .hasAnyRole("CIE_OPERATOR", "CIE_ADMIN")
                        .anyRequest().authenticated()
                )
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((request, response, authException) ->
                                response.sendError(401, "Authentification requise"))
                        .accessDeniedHandler((request, response, accessDeniedException) ->
                                response.sendError(403, "Accès refusé")))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
