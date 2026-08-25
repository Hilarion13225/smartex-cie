package ci.cie.smartprepaid.customer.api;

import ci.cie.smartprepaid.customer.dto.*;
import ci.cie.smartprepaid.customer.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Domaine customer/auth (docs/05_reconciliation-api-frontend-backend.md §8).
 * Mécanisme OTP-only : ni /register ni /login n'authentifient directement —
 * les deux déclenchent l'envoi d'un OTP (voir ConsoleOtpSender) ; seul
 * /verify-otp délivre un JWT.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request.phoneNumber(), request.displayName(), request.password(),
                request.email(), request.meterId(), request.contractId());
        return ResponseEntity.accepted().body(new RegisterResponse(true));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        authService.login(request.phoneNumber());
        return ResponseEntity.accepted().body(new LoginResponse(true));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<VerifyOtpResponse> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        var result = authService.verifyOtp(request.phoneNumber(), request.code());
        return ResponseEntity.ok(new VerifyOtpResponse(true, CustomerResponse.from(result.customer()), result.token()));
    }
}
