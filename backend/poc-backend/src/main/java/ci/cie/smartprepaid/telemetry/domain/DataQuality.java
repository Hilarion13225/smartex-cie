package ci.cie.smartprepaid.telemetry.domain;

/**
 * Indique si l'autonomie retournée par CreditAutonomyService s'appuie sur une
 * consommation réellement mesurée (REAL) ou sur une valeur de secours
 * configurée faute d'historique suffisant (FALLBACK) — jamais une erreur,
 * jamais une valeur inventée sans le dire (voir CreditAutonomyService).
 */
public enum DataQuality {
    REAL,
    FALLBACK
}
