package ci.cie.smartprepaid.customer.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Endpoints ouverts : /api/v1/auth/** (l'auth elle-même), /api/v1/meters/** et
 * /api/v1/payments/callback et /api/v1/devices/** (flux système/support —
 * payment-simulator, mock-dongle — pas des clients navigateur, cf.
 * docs/05_reconciliation-api-frontend-backend.md instruction Phase 2 §5) et
 * /actuator/**. Tout le reste (/api/v1/recharges, /api/v1/commands/{id}/retry,
 * /api/v1/audit, /api/v1/support/timeline, /api/v1/customers/me) exige un JWT
 * valide — aucune restriction par rôle à ce stade (pas demandé, éviter la
 * sur-ingénierie).
 */
@Configuration
@EnableWebSecurity
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
                        .anyRequest().authenticated()
                )
                .exceptionHandling(e -> e.authenticationEntryPoint(
                        (request, response, authException) ->
                                response.sendError(401, "Authentification requise")))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
