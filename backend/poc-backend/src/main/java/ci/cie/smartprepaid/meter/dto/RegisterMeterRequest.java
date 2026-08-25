package ci.cie.smartprepaid.meter.dto;

import jakarta.validation.constraints.NotBlank;

/** POST /api/v1/meters/registry (admin -- voir MeterController). */
public record RegisterMeterRequest(@NotBlank String meterId, String label) {}
