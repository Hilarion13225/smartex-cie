package ci.cie.smartprepaid.common;

/** Exception métier portant un code stable exploitable par le frontend/support. */
public class DomainException extends RuntimeException {
    private final String code;

    public DomainException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
