package ci.cie.smartprepaid.device.domain;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "device")
public class Device {

    @Id
    @Column(name = "device_id", nullable = false, updatable = false)
    private String deviceId;

    @Column(name = "meter_id", nullable = false, unique = true)
    private String meterId;

    @Column(name = "cert_id")
    private String certId;

    @Column(name = "firmware_version")
    private String firmwareVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private DeviceStatus status = DeviceStatus.UNKNOWN;

    @Column(name = "last_seen")
    private Instant lastSeen;

    protected Device() {
        // JPA
    }

    public Device(String deviceId, String meterId, String certId, String firmwareVersion) {
        this.deviceId = deviceId;
        this.meterId = meterId;
        this.certId = certId;
        this.firmwareVersion = firmwareVersion;
    }

    public void heartbeat() {
        this.lastSeen = Instant.now();
        this.status = DeviceStatus.ONLINE;
    }

    public void markOffline() {
        this.status = DeviceStatus.OFFLINE;
    }

    public String getDeviceId() { return deviceId; }
    public String getMeterId() { return meterId; }
    public String getCertId() { return certId; }
    public String getFirmwareVersion() { return firmwareVersion; }
    public DeviceStatus getStatus() { return status; }
    public Instant getLastSeen() { return lastSeen; }
}
