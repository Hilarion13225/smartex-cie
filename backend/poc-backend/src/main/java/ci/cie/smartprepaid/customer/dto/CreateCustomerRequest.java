package ci.cie.smartprepaid.customer.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * POST /api/v1/customers (admin -- voir CustomerController#create). Contrairement à
 * /auth/register (toujours CLIENT, auto-inscription), permet à un admin de créer
 * directement un compte opérateur/admin sans passer par l'auto-inscription -- le rôle
 * cible n'existe autrement que via un seed de migration (V4__seed_lab_operator.sql).
 * Pas de mot de passe/OTP ici : le compte créé se connecte ensuite par le flux normal
 * (login + OTP), exactement comme n'importe quel autre compte.
 */
public record CreateCustomerRequest(@NotBlank String phoneNumber, @NotBlank String displayName,
                                     @NotBlank String role, String email) {}
