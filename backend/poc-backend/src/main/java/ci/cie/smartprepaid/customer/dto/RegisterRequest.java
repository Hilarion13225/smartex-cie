package ci.cie.smartprepaid.customer.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * POST /api/v1/auth/register. `password` optionnel — voir AuthService (OTP-only).
 * `email` : nécessaire pour l'envoi du code OTP par email (voir BrevoOtpSender), optionnel
 * seulement pour ne pas casser un client qui ne l'enverrait pas encore.
 * `meterId`/`contractId` : optionnels -- un compte peut exister sans compteur associé
 * (voir AuthService.register, qui valide meterId contre le registre `meter` uniquement
 * s'il est fourni).
 */
public record RegisterRequest(@NotBlank String phoneNumber, @NotBlank String displayName, String password,
                               String email, String meterId, String contractId) {}
