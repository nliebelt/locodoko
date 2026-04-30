package de.locodoko.spieler;

import de.locodoko.partie.ereignisse.SpielBeendet;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

@SpringBootTest
class SpielerStatistikIntegrationTest {

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private SpielerRepository spielerRepository;

    @Autowired
    private SpielerStatistikRepository statistikRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Test
    void eventVerarbeitungAktualisiertStatistik() {
        // Given: Ein Spieler existiert (in eigener Transaktion speichern)
        UUID spielerId = transactionTemplate.execute(status -> {
            SpielerEntity spieler = SpielerEntity.menschlich("TestPlayer", UUID.randomUUID().toString());
            return spielerRepository.save(spieler).id();
        });

        // When: SpielBeendet Event wird gefeuert (in Transaktion, damit AfterCommit-Listener greift)
        transactionTemplate.executeWithoutResult(status -> {
            SpielBeendet.SpielerSpielDaten daten = new SpielBeendet.SpielerSpielDaten(
                true, 3, 1, 0, 1, 0, false
            );
            SpielBeendet event = new SpielBeendet(
                UUID.randomUUID(), "TestTisch", 1, Map.of(spielerId, daten)
            );
            eventPublisher.publishEvent(event);
        });

        // Then: Statistik ist aktualisiert (Modulith Listener ist async)
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
            SpielerStatistik statistik = statistikRepository.findBySpielerId(spielerId).orElse(null);
            assertThat(statistik).isNotNull();
            assertThat(statistik.anzahlSpiele()).isEqualTo(1);
            assertThat(statistik.anzahlSiege()).isEqualTo(1);
            assertThat(statistik.gesamtPunkte()).isEqualTo(3);
            assertThat(statistik.fuchsGefangen()).isEqualTo(1);
            assertThat(statistik.karlchenGespielt()).isEqualTo(1);
        });
    }
}
