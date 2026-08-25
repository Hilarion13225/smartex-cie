package ci.cie.smartprepaid.telemetry.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Un point de l'historique de consommation (voir ConsumptionHistoryService). Les libellés
 * d'affichage (ex. "Lun", "S1", noms de mois) sont un souci d'UI laissé au frontend, pas
 * inventés côté backend -- seuls des instants exacts sont exposés ici.
 */
public record ConsumptionBucket(Instant bucketStart, Instant bucketEnd, BigDecimal consumptionFcfa,
                                 DataQuality dataQuality) {}
