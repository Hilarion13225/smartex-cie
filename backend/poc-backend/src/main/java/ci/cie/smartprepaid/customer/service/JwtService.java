package ci.cie.smartprepaid.customer.service;

import ci.cie.smartprepaid.customer.domain.CustomerRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

/**
 * Génération/validation JWT minimale pour le PoC : pas de refresh token, pas de
 * révocation, expiration fixe et raisonnable. `jwt.secret` suit la même
 * convention que les autres identifiants de labo du projet (valeur par défaut
 * dans application.yml, prévue pour être surchargée par variable d'env — voir
 * DB_PASSWORD) : à remplacer avant tout environnement non-labo.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationSeconds;

    public JwtService(@Value("${jwt.secret}") String secret,
                       @Value("${jwt.expiration-seconds:86400}") long expirationSeconds) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationSeconds = expirationSeconds;
    }

    public String generate(UUID customerId, CustomerRole role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(customerId.toString())
                .claim("role", role.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(expirationSeconds)))
                .signWith(key)
                .compact();
    }

    /** Vide si le token est absent, expiré, malformé ou signé avec une autre clé. */
    public Optional<Claims> validate(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.of(claims);
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
