package ci.cie.smartprepaid.meteradapter;

import java.math.BigDecimal;

public record MeterCredit(String meterId, BigDecimal creditBalance, String unit) {}
