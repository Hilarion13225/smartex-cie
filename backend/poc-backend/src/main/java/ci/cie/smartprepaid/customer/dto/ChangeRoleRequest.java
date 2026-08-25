package ci.cie.smartprepaid.customer.dto;

import jakarta.validation.constraints.NotBlank;

/** PATCH /api/v1/customers/{id}/role (admin -- voir CustomerController#changeRole). */
public record ChangeRoleRequest(@NotBlank String role) {}
