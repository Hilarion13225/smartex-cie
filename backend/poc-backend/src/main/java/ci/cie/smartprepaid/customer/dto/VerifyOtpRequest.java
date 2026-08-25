package ci.cie.smartprepaid.customer.dto;

import jakarta.validation.constraints.NotBlank;

/** POST /api/v1/auth/verify-otp — commun aux flux register et login. */
public record VerifyOtpRequest(@NotBlank String phoneNumber, @NotBlank String code) {}
