package ci.cie.smartprepaid.telemetry.domain;

/**
 * Classification de l'autonomie de crédit restante (ALG-01 simplifié, sans
 * pondération saisonnière ni profil par segment client — voir
 * CreditAutonomyService). Seuils repris tels que spécifiés pour cette version
 * simplifiée : NORMAL > 7j, WARNING <= 7j, CRITICAL <= 3j, IMMEDIATE <= 1j.
 */
public enum CreditStatus {
    NORMAL,
    WARNING,
    CRITICAL,
    IMMEDIATE
}
