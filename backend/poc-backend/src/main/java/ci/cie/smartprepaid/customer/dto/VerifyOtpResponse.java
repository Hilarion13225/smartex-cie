package ci.cie.smartprepaid.customer.dto;

public record VerifyOtpResponse(boolean verified, CustomerResponse customer, String token) {}
