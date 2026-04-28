package de.locodoko.tisch;

import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.SpielerPosition;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

/**
 * Unit-Tests fuer die Factory-Methoden von {@link PartieEreignisAntwort}.
 */
class PartieEreignisAntwortTest {

    @Test
    void schweinchenGemeldetEnthaltSpielerPosition() {
        // Wichtig: Das Frontend ermittelt den Spielernamen fuer den Banner anhand
        // der spielerPosition im Event. Fehlt sie, zeigt der Banner immer "Spieler: Schweinchen!".
        PartieStandAntwort stand = new PartieStandAntwort(
            null, 42L, PartieStatus.LAUFEND, 8, 0, Map.of(), null, List.of(), null
        );

        PartieEreignisAntwort ergebnis = PartieEreignisAntwort.schweinchenGemeldet(stand, SpielerPosition.WEST);

        var dto = assertInstanceOf(PartieEreignisAntwort.SchweinchenGemeldet.class, ergebnis);
        assertEquals(SpielerPosition.WEST, dto.spielerPosition(),
            "spielerPosition muss korrekt weitergegeben werden, damit das Frontend den richtigen Spielernamen im Banner zeigt.");
        assertEquals(PartieEreignisTyp.SCHWEINCHEN_GEMELDET, dto.ereignisTyp());
        assertEquals(42L, dto.version());
    }
}
