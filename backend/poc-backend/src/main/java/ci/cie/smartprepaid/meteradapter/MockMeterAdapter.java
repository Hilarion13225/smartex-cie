package ci.cie.smartprepaid.meteradapter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;

/**
 * Implémentation PoC de laboratoire: interroge le simulateur Python "mock-dongle"
 * en HTTP (voir /simulators/mock-dongle) au lieu d'un vrai compteur/protocole.
 * À remplacer par un adapter réel uniquement après qualification CIE du modèle
 * de compteur (§P2 / §13 MeterAdapter du Developer Pack).
 */
@Component
public class MockMeterAdapter implements MeterAdapterPort {

    private final RestClient restClient;

    public MockMeterAdapter(@Value("${meter-adapter.mock-dongle-base-url}") String baseUrl) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
    }

    @Override
    public MeterStatus readStatus(String meterId) {
        MockDongleStatusDto dto = restClient.get()
                .uri("/meters/{meterId}/status", meterId)
                .retrieve()
                .body(MockDongleStatusDto.class);
        if (dto == null) {
            return new MeterStatus(meterId, false, "UNREACHABLE");
        }
        return new MeterStatus(meterId, dto.online(), dto.state());
    }

    @Override
    public MeterCredit readCredit(String meterId) {
        MockDongleCreditDto dto = restClient.get()
                .uri("/meters/{meterId}/credit", meterId)
                .retrieve()
                .body(MockDongleCreditDto.class);
        BigDecimal credit = dto != null ? dto.creditFcfa() : BigDecimal.ZERO;
        return new MeterCredit(meterId, credit, "FCFA");
    }

    @Override
    public boolean healthcheck(String meterId) {
        try {
            MockDongleStatusDto dto = restClient.get()
                    .uri("/meters/{meterId}/status", meterId)
                    .retrieve()
                    .body(MockDongleStatusDto.class);
            return dto != null && dto.online();
        } catch (Exception e) {
            return false;
        }
    }

    private record MockDongleStatusDto(boolean online, String state) {}
    private record MockDongleCreditDto(BigDecimal creditFcfa) {}
}
