package de.locodoko.spieler;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class KiSpielerFabrikTest {

    @Autowired
    private KiSpielerFabrik kiSpielerFabrik;

    @Autowired
    private SpielerRepository spielerRepository;

    @Test
    void erzeugtKiSpielerMitAutomatischemNamenOhneSession() {
        SpielerEntity kiSpieler = kiSpielerFabrik.erzeugeNaechstenSpieler();

        assertTrue(kiSpieler.istKi(),
            "KI-Spieler muessen explizit markiert sein, damit Lobby und spaetere Zuglogik sie ohne Session behandeln koennen.");
        assertEquals("KI Anna", kiSpieler.name(),
            "Der erste automatisch erzeugte Name bildet die erwartete KI-Benennung ab, auf die Startlogik und UI spaeter vertrauen.");
        assertNull(kiSpieler.sessionId(),
            "KI-Spieler duerfen keine Session-ID tragen, weil die Session-basierte Identifikation ausschliesslich fuer Menschen gilt.");
    }

    @Test
    void vergibtFortlaufendeKiNamenAuchWennBereitsNamenBelegtSind() {
        spielerRepository.saveAndFlush(SpielerEntity.ki("KI Anna"));
        spielerRepository.saveAndFlush(SpielerEntity.ki("KI Bob"));

        SpielerEntity kiSpieler = kiSpielerFabrik.erzeugeNaechstenSpieler();

        assertEquals("KI Clara", kiSpieler.name(),
            "Die KI-Namensvergabe muss zum naechsten freien Standardnamen weiterschalten, damit aufgefuellte Tische lesbar und stabil bleiben.");
    }
}
