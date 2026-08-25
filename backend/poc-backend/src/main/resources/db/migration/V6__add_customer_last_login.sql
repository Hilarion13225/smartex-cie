-- Suivi de derniere connexion reussie (OTP verifie) -- voir AuthService#verifyOtp
-- et Customer#recordLogin. Null pour un compte jamais encore connecte.
ALTER TABLE customer ADD COLUMN last_login_at TIMESTAMPTZ;
