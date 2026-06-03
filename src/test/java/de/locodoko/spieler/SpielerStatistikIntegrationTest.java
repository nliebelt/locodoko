package de.locodoko.spieler;

import de.locodoko.karten.Regelvariante;
import de.locodoko.partie.ereignisse.SpielBeendet;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
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
                true, 3, 1, 0, 1, 0, false, 3,
                true, "", false, false, 130
            );
            SpielBeendet event = new SpielBeendet(
                UUID.randomUUID(), "TestTisch", 1, Map.of(spielerId, daten), false,
                Regelvariante.TURNIER
            );
            eventPublisher.publishEvent(event);
        });

        // Then: Statistik ist aktualisiert (Modulith Listener ist async)
        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
            List<SpielerStatistik> statistiken = statistikRepository.findBySpielerId(spielerId);
            assertThat(statistiken).hasSize(1);
            SpielerStatistik statistik = statistiken.get(0);
            assertThat(statistik.regelvariante()).isEqualTo("TURNIER");
            assertThat(statistik.anzahlSpiele()).isEqualTo(1);
            assertThat(statistik.anzahlSiege()).isEqualTo(1);
            assertThat(statistik.gesamtPunkte()).isEqualTo(3);
            assertThat(statistik.fuchsGefangen()).isEqualTo(1);
            assertThat(statistik.karlchenGespielt()).isEqualTo(1);
            assertThat(statistik.reSiege()).isEqualTo(1);
        });
    }

    @Test
    void zweiRegelvarianten_erstellenJeweiligeStatistikZeilen() {
        UUID spielerId = transactionTemplate.execute(status -> {
            SpielerEntity spieler = SpielerEntity.menschlich("TestPlayer2", UUID.randomUUID().toString());
            return spielerRepository.save(spieler).id();
        });

        // Turnier-Spiel
        transactionTemplate.executeWithoutResult(status -> {
            SpielBeendet.SpielerSpielDaten daten = new SpielBeendet.SpielerSpielDaten(
                true, 2, 0, 0, 0, 0, false, 2, true, "", false, false, 125
            );
            eventPublisher.publishEvent(new SpielBeendet(
                UUID.randomUUID(), "Tisch1", 1, Map.of(spielerId, daten), false, Regelvariante.TURNIER
            ));
        });

        // Sonder-Spiel
        transactionTemplate.executeWithoutResult(status -> {
            SpielBeendet.SpielerSpielDaten daten = new SpielBeendet.SpielerSpielDaten(
                false, -1, 0, 0, 0, 0, false, -1, false, "", false, false, 115
            );
            eventPublisher.publishEvent(new SpielBeendet(
                UUID.randomUUID(), "Tisch2", 1, Map.of(spielerId, daten), false, Regelvariante.SONDER
            ));
        });

        await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
            List<SpielerStatistik> statistiken = statistikRepository.findBySpielerId(spielerId);
            assertThat(statistiken).hasSize(2);
            assertThat(statistiken.stream().map(SpielerStatistik::regelvariante))
                .containsExactlyInAnyOrder("TURNIER", "SONDER");
        });
    }
}
