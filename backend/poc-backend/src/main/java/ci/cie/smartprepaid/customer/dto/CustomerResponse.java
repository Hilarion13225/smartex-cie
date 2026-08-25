package ci.cie.smartprepaid.customer.dto;

import ci.cie.smartprepaid.customer.domain.Customer;

import java.time.Instant;
import java.util.UUID;

/** Ne jamais exposer {@code passwordHash} ici. */
public record CustomerResponse(UUID customerId, String phoneNumber, String displayName, String role,
                                boolean phoneVerified, Instant createdAt) {
    public static CustomerResponse from(Customer c) {
        return new CustomerResponse(c.getCustomerId(), c.getPhoneNumber(), c.getDisplayName(),
                c.getRole().name(), c.isPhoneVerified(), c.getCreatedAt());
    }
}
