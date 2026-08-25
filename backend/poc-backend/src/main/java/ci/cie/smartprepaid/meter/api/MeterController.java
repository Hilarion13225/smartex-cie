package ci.cie.smartprepaid.meter.api;

import ci.cie.smartprepaid.common.DomainException;
import ci.cie.smartprepaid.customer.repo.CustomerRepository;
import ci.cie.smartprepaid.device.repo.DeviceRepository;
import ci.cie.smartprepaid.meter.domain.Meter;
import ci.cie.smartprepaid.meter.dto.MeterRegistryEntry;
import ci.cie.smartprepaid.meter.dto.RegisterMeterRequest;
import ci.cie.smartprepaid.meter.repo.MeterRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Registre des compteurs connus de la CIE (voir meter.domain.Meter, V8 migration) --
 * distinct de {@code GET /api/v1/meters} (device/api/DeviceController), qui reste une vue
 * de supervision flotte orientée statut device/télémétrie. Ici : gestion admin de la liste
 * des compteurs eux-mêmes, base de la validation à l'inscription (voir
 * customer.service.AuthService#register). Chemin distinct ("/registry") pour ne créer
 * aucune ambiguïté de routage avec DeviceController, déjà propriétaire de GET
 * /api/v1/meters -- même préfixe /api/v1/meters/** (permitAll au niveau URL, voir
 * SecurityConfig), rôle vérifié ici via @PreAuthorize comme le reste du contrôleur voisin.
 */
@RestController
@RequestMapping("/api/v1/meters/registry")
public class MeterController {

    private final MeterRepository meterRepository;
    private final DeviceRepository deviceRepository;
    private final CustomerRepository customerRepository;

    public MeterController(MeterRepository meterRepository, DeviceRepository deviceRepository,
                            CustomerRepository customerRepository) {
        this.meterRepository = meterRepository;
        this.deviceRepository = deviceRepository;
        this.customerRepository = customerRepository;
    }

    @PreAuthorize("hasAnyRole('CIE_OPERATOR','CIE_ADMIN','DSI_ADMIN')")
    @GetMapping
    public List<MeterRegistryEntry> list() {
        return meterRepository.findAll().stream()
                .map(m -> new MeterRegistryEntry(
                        m.getMeterId(),
                        m.getLabel(),
                        m.getCreatedAt(),
                        deviceRepository.findByMeterId(m.getMeterId()).isPresent(),
                        customerRepository.findByMeterId(m.getMeterId())
                                .map(c -> c.getCustomerId().toString())
                                .orElse(null)))
                .toList();
    }

    @PreAuthorize("hasAnyRole('CIE_OPERATOR','CIE_ADMIN','DSI_ADMIN')")
    @PostMapping
    public ResponseEntity<MeterRegistryEntry> register(@Valid @RequestBody RegisterMeterRequest request) {
        if (meterRepository.existsById(request.meterId())) {
            throw new DomainException("DUPLICATE", "Ce compteur est déjà enregistré: " + request.meterId());
        }
        Meter meter = meterRepository.save(new Meter(request.meterId(), request.label()));
        return ResponseEntity.status(201).body(
                new MeterRegistryEntry(meter.getMeterId(), meter.getLabel(), meter.getCreatedAt(), false, null));
    }
}
