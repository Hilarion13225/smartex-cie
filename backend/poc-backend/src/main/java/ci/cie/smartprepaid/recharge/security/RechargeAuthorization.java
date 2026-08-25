package ci.cie.smartprepaid.recharge.security;

import ci.cie.smartprepaid.recharge.repo.RechargeRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Vérification d'ownership réutilisable pour les endpoints recharge/{id}, appelée
 * depuis une expression SpEL {@code @PreAuthorize} plutôt que dupliquée dans chaque
 * contrôleur (voir {@code customer.security.SecurityConfig} pour la matrice
 * rôle × endpoint complète).
 *
 * Si la recharge n'existe pas, {@code isOwner} renvoie {@code true} : ce n'est pas
 * à cette couche d'autorisation de décider du 404, c'est au contrôleur (via
 * {@code DomainException("NOT_FOUND", ...)}) — sinon un ID inexistant renverrait
 * 403 au lieu de 404 et laisserait croire à tort qu'une ressource protégée existe.
 */
@Component("rechargeAuthorization")
public class RechargeAuthorization {

    private final RechargeRepository rechargeRepository;

    public RechargeAuthorization(RechargeRepository rechargeRepository) {
        this.rechargeRepository = rechargeRepository;
    }

    public boolean isOwner(UUID rechargeId, Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        return rechargeRepository.findById(rechargeId)
                .map(recharge -> authentication.getName().equals(recharge.getCustomerId()))
                .orElse(true);
    }
}
