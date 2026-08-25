package ci.cie.smartprepaid.telemetry;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;

@ConfigurationProperties(prefix = "telemetry")
public class TelemetryProperties {

    /** Intervalle entre deux passages de TelemetryCollector (un relevé de crédit par device connu). */
    private long collectionIntervalSeconds = 300;

    /** Fenêtre glissante utilisée par CreditAutonomyService pour la moyenne de consommation. */
    private int lookbackDays = 7;

    /**
     * Nombre minimal de relevés exploitables (au moins 2 intervalles calculables) en-deçà duquel
     * CreditAutonomyService bascule sur fallbackDailyConsumptionFcfa (dataQuality=FALLBACK) plutôt
     * que d'inventer une tendance à partir de trop peu de points.
     */
    private int minReadingsForReal = 3;

    /** Consommation journalière par défaut utilisée en dataQuality=FALLBACK — jamais une erreur. */
    private BigDecimal fallbackDailyConsumptionFcfa = BigDecimal.valueOf(500);

    public long getCollectionIntervalSeconds() { return collectionIntervalSeconds; }
    public void setCollectionIntervalSeconds(long collectionIntervalSeconds) {
        this.collectionIntervalSeconds = collectionIntervalSeconds;
    }
    public int getLookbackDays() { return lookbackDays; }
    public void setLookbackDays(int lookbackDays) { this.lookbackDays = lookbackDays; }
    public int getMinReadingsForReal() { return minReadingsForReal; }
    public void setMinReadingsForReal(int minReadingsForReal) { this.minReadingsForReal = minReadingsForReal; }
    public BigDecimal getFallbackDailyConsumptionFcfa() { return fallbackDailyConsumptionFcfa; }
    public void setFallbackDailyConsumptionFcfa(BigDecimal fallbackDailyConsumptionFcfa) {
        this.fallbackDailyConsumptionFcfa = fallbackDailyConsumptionFcfa;
    }
}
