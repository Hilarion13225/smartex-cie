package ci.cie.smartprepaid.customer.dto;

import jakarta.validation.constraints.NotBlank;

/** POST /api/v1/auth/login. OTP-only : pas de mot de passe, déclenche un envoi OTP. */
public record LoginRequest(@NotBlank String phoneNumber) {}
