package ci.cie.smartprepaid.meteradapter;

/**
 * Port (au sens hexagonal) vers le compteur/dongle. Aucun service métier ne doit
 * connaître le protocole réel (DLMS/COSEM, STS, port optique...) — voir §13
 * MeterAdapter du Developer Pack: "Ne jamais coder le protocole réel directement
 * dans le service métier". La commande transite en réalité via MQTT vers le
 * dongle (voir mqtt.CommandPublisher) ; cette interface représente le contrat
 * fonctionnel côté métier, aujourd'hui réalisé par MockMeterAdapter (HTTP) pour
 * les lectures directes hors-flux-commande (statut, healthcheck).
 */
public interface MeterAdapterPort {

    MeterStatus readStatus(String meterId);

    MeterCredit readCredit(String meterId);

    boolean healthcheck(String meterId);
}
