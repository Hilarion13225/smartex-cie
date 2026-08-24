package ci.cie.smartprepaid.meteradapter;

public record MeterStatus(String meterId, boolean online, String rawState) {}
