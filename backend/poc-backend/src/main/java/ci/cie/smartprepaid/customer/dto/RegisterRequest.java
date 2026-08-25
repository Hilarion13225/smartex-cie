package ci.cie.smartprepaid.customer.dto;

import jakarta.validation.constraints.NotBlank;

/** POST /api/v1/auth/register. `password` optionnel — voir AuthService (OTP-only). */
public record RegisterRequest(@NotBlank String phoneNumber, @NotBlank String displayName, String password) {}
