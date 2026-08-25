package ci.cie.smartprepaid.recharge.repo;

import ci.cie.smartprepaid.recharge.domain.CommandStatus;
import ci.cie.smartprepaid.recharge.domain.MeterCommand;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CommandRepository extends JpaRepository<MeterCommand, UUID> {
    List<MeterCommand> findByRechargeIdOrderBySequenceAsc(UUID rechargeId);
    Optional<MeterCommand> findTopByDeviceIdOrderBySequenceDesc(String deviceId);
    Optional<MeterCommand> findByRechargeIdAndStatusIn(UUID rechargeId, List<CommandStatus> statuses);

    /** T07: commandes non terminales (PENDING/SENT) dont la fenêtre de validité est dépassée. */
    List<MeterCommand> findByStatusInAndExpiresAtBefore(List<CommandStatus> statuses, Instant expiresAtBefore);

    /**
     * UPDATE conditionnel atomique (pas de lecture-modification-écriture en mémoire) : le dongle
     * peut ACKer en quelques millisecondes, avant même que cette méthode n'ait eu l'occasion de
     * s'exécuter (voir CommandSendFinalizer). Un pattern find -> check en mémoire -> save() est
     * sujet à un "lost update" classique si {@link ci.cie.smartprepaid.recharge.service
     * .RechargeOrchestrator#handleAck} committe son propre changement (ACCEPTED) *entre* le
     * chargement et la sauvegarde de cette méthode : la vérification en mémoire ne voit pas ce
     * changement concurrent et écrase SENT par-dessus ACCEPTED déjà persisté. Ce bug réel a été
     * découvert sous charge concurrente légère (T14, ~1/60 tentatives) -- invisible en usage
     * séquentiel où la fenêtre de course est minuscule. Renvoie le nombre de lignes affectées (0
     * si la commande n'était déjà plus PENDING au moment de l'UPDATE -- ACK concurrent gagnant).
     */
    @Modifying
    @Query("UPDATE MeterCommand c SET c.status = :newStatus, c.sentAt = :sentAt "
            + "WHERE c.commandId = :id AND c.status = :expectedStatus")
    int markSentIfStatus(@Param("id") UUID commandId, @Param("expectedStatus") CommandStatus expectedStatus,
                          @Param("newStatus") CommandStatus newStatus, @Param("sentAt") Instant sentAt);
}
