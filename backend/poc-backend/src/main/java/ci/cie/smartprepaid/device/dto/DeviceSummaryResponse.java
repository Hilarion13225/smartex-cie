package ci.cie.smartprepaid.device.dto;

import ci.cie.smartprepaid.device.domain.Device;

import java.time.Instant;

/**
 * credentialStatus toujours "VALID" : le backend ne suit aujourd'hui aucune expiration/
 * révocation de certificat par device (seul {@code certId} est stocké, pas de date
 * d'expiration ni de statut de révocation) -- valeur neutre documentée plutôt qu'inventée
 * (voir docs/05_reconciliation-api-frontend-backend.md).
 */
public record DeviceSummaryResponse(String deviceId, String meterId, String firmwareVersion, String status,
                                     String credentialStatus, Instant lastSeen) {
    public static DeviceSummaryResponse from(Device d) {
        return new DeviceSummaryResponse(d.getDeviceId(), d.getMeterId(), d.getFirmwareVersion(),
                d.getStatus().name(), "VALID", d.getLastSeen());
    }
}
