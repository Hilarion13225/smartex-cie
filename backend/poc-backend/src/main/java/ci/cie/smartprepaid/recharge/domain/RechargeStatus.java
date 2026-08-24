package ci.cie.smartprepaid.recharge.domain;

/**
 * Cf. RG-C-006 (transparence statut) et ALG-02: paiement reçu -> recharge en
 * cours -> compteur crédité, ou échec/fallback si l'injection auto échoue.
 */
public enum RechargeStatus {
    CREATED,
    TOKEN_GENERATED,
    COMMAND_SENT,
    CREDIT_APPLIED,      // succès terminal
    COMMAND_REJECTED,    // échec terminal, incident créé
    COMMAND_TIMEOUT,     // en attente de retry ou de fallback
    FALLBACK_TOKEN_SENT  // succès dégradé: client doit saisir le token manuellement
}
