package ci.cie.smartprepaid.customer.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * PUT /api/v1/customers/{id}/meter (admin -- voir CustomerController#assignMeter).
 * Réassignation : détache d'abord l'ancien compteur (le cas échéant) avant de lier le
 * nouveau, mêmes règles de validation qu'à l'inscription (meterId doit exister dans le
 * registre et ne pas être déjà lié à un AUTRE client).
 */
public record AssignMeterRequest(@NotBlank String meterId, String contractId) {}
