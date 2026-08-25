package ci.cie.smartprepaid.meter.dto;

import java.time.Instant;

/**
 * GET /api/v1/meters/registry (admin -- voir MeterController). {@code hasDevice} et
 * {@code claimedByCustomerId} donnent une visibilité complète à l'admin sur l'état réel
 * de chaque compteur enregistré : un compteur peut exister sans dongle installé et/ou
 * sans client associé (rollout réel typique, voir Meter.java).
 */
public record MeterRegistryEntry(String meterId, String label, Instant createdAt, boolean hasDevice,
                                  String claimedByCustomerId) {}
