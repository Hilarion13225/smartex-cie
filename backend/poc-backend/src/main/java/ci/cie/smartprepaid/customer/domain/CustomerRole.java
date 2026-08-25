package ci.cie.smartprepaid.customer.domain;

/**
 * Rôles identifiés dans docs/05_reconciliation-api-frontend-backend.md §7
 * (trace uniquement à des mentions génériques "RBAC" dans docs/03, aucune
 * taxonomie précise n'y est documentée — celle-ci est celle du frontend).
 */
public enum CustomerRole {
    CLIENT,
    CIE_OPERATOR,
    CIE_ADMIN,
    DSI_ADMIN
}
