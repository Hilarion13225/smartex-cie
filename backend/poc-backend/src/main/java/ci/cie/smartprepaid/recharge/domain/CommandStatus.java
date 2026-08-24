package ci.cie.smartprepaid.recharge.domain;

public enum CommandStatus {
    PENDING,
    SENT,
    ACCEPTED,   // T04: token valide, compteur ACCEPTED
    REJECTED,   // T05: token invalide -> REJECTED
    TIMEOUT,    // T07: pas d'ACK dans la fenêtre
    DUPLICATE   // T06/T12: rejeu détecté
}
