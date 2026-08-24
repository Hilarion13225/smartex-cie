package ci.cie.smartprepaid.common;

import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DomainException.class)
    public ResponseEntity<ApiError> handleDomain(DomainException ex) {
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        HttpStatus status = switch (ex.getCode()) {
            case "NOT_FOUND" -> HttpStatus.NOT_FOUND;
            case "DUPLICATE", "IDEMPOTENT_REPLAY" -> HttpStatus.CONFLICT;
            case "INELIGIBLE", "VALIDATION" -> HttpStatus.UNPROCESSABLE_ENTITY;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(ApiError.of(ex.getCode(), ex.getMessage(), correlationId));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        return ResponseEntity.internalServerError()
                .body(ApiError.of("INTERNAL_ERROR", "Erreur interne inattendue", correlationId));
    }
}
