package de.locodoko.partie;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit-Tests fuer das Stichverlauf-ValueObject.
 *
 * <p>Prueft Factory-Methoden (leer, aus), Zustandsmutationen (mitStich),
 * Abfragen (letzter, anzahl, istLeer), Gleichheit und Unveraenderlichkeit.
 * JaCoCo meldet 50% Instr / 0% Branches vor diesen Tests, da Stichverlauf
 * bisher nur indirekt via SpielTestBuilder genutzt wird — diese Tests
 * decken alle Branch-Pfade direkt ab.</p>
 */
class StichverlaufTest {

    private static final Stich STICH_SUED = Stich.neu(SpielerPosition.SUED);
    private static final Stich STICH_NORD = Stich.neu(SpielerPosition.NORD);
    private static final Stich STICH_OST  = Stich.neu(SpielerPosition.OST);

    // =========================================================================
    // Factory: leer()
    // =========================================================================

    @Test
    void leer_erstelltLeerenVerlauf() {
        // Warum wichtig: leer() ist der Eintrittspunkt bei Spielbeginn; ein nicht-leerer
        // Initialzustand wuerde den Stich-Zaehlstand und Spielende-Erkennung verfaelschen.
        Stichverlauf verlauf = Stichverlauf.leer();
        assertTrue(verlauf.istLeer());
        assertEquals(0, verlauf.anzahl());
        assertEquals(List.of(), verlauf.stiche());
    }

    // =========================================================================
    // Factory: aus(List<Stich>)
    // =========================================================================

    @Test
    void aus_erstelltVerlaufMitGegebenenStichen() {
        // Warum wichtig: aus() wird fuer die Deserialisierung aus der DB/JSON verwendet.
        // Falsche Inhalte wuerden den gesamten Spielstand korrumpieren.
        Stichverlauf verlauf = Stichverlauf.aus(List.of(STICH_SUED, STICH_NORD));
        assertEquals(2, verlauf.anzahl());
        assertEquals(List.of(STICH_SUED, STICH_NORD), verlauf.stiche());
    }

    @Test
    void aus_wirftNPE_wennStichlisteNull() {
        // Warum wichtig: null-Liste wuerde in anzahl()/stiche() zu NullPointerException
        // an unerwarteter Stelle fuehren und erschwert Debugging.
        assertThrows(NullPointerException.class, () -> Stichverlauf.aus(null));
    }

    @Test
    void aus_erstelltDefensiveKopie_AenderungDerOriginallisteBleibtOhneWirkung() {
        // Warum wichtig: Stichverlauf ist ein Value Object — externe Mutation der
        // Quellliste darf den internen Zustand nicht veraendern (Unveraenderlichkeit-Garantie).
        List<Stich> mutable = new ArrayList<>(List.of(STICH_SUED));
        Stichverlauf verlauf = Stichverlauf.aus(mutable);
        mutable.add(STICH_NORD);
        assertEquals(1, verlauf.anzahl(), "Externe Listenmutation darf Stichverlauf nicht veraendern");
    }

    // =========================================================================
    // mitStich(Stich)
    // =========================================================================

    @Test
    void mitStich_gibtNeueInstanzMitAngehaengtemStich() {
        // Warum wichtig: mitStich ist die zentrale Mutations-Methode im Spielablauf.
        // Wird nach jedem vollstaendigen Stich aufgerufen — korrekte Rueckgabe ist Pflicht.
        Stichverlauf leer = Stichverlauf.leer();
        Stichverlauf einStich = leer.mitStich(STICH_SUED);
        assertEquals(1, einStich.anzahl());
        assertEquals(STICH_SUED, einStich.stiche().getFirst());
    }

    @Test
    void mitStich_laessstOriginalUnveraendert() {
        // Warum wichtig: Immutabilitaet ist zentral fuer die Zustandssicherheit — der
        // vorherige Spielzustand muss unberuehrt bleiben (Copy-on-Write-Semantik).
        Stichverlauf original = Stichverlauf.aus(List.of(STICH_SUED));
        original.mitStich(STICH_NORD);
        assertEquals(1, original.anzahl(), "Original darf durch mitStich nicht veraendert werden");
    }

    @Test
    void mitStich_anhaengenMehrererSticheErhaltReihenfolge() {
        // Warum wichtig: Die zeitliche Reihenfolge der Stiche ist fuer Auswertung,
        // Letzter-Stich-Overlay und Spielprotokoll unverzichtbar.
        Stichverlauf verlauf = Stichverlauf.leer()
            .mitStich(STICH_SUED)
            .mitStich(STICH_NORD)
            .mitStich(STICH_OST);
        assertEquals(3, verlauf.anzahl());
        assertEquals(STICH_SUED, verlauf.stiche().get(0));
        assertEquals(STICH_NORD, verlauf.stiche().get(1));
        assertEquals(STICH_OST,  verlauf.stiche().get(2));
    }

    @Test
    void mitStich_wirftNPE_wennStichNull() {
        // Warum wichtig: null-Stich wuerde die interne Liste korrumpieren und erst
        // spaet (bei Auswertung) eine schwer zuordenbare NullPointerException ausloesen.
        Stichverlauf verlauf = Stichverlauf.leer();
        assertThrows(NullPointerException.class, () -> verlauf.mitStich(null));
    }

    // =========================================================================
    // letzter()
    // =========================================================================

    @Test
    void letzter_gibtLetztenStichZurueck() {
        // Warum wichtig: letzter() wird nach jedem Stich aufgerufen um den
        // Naechsten-Aufspieler fuer das Frontend zu bestimmen.
        Stichverlauf verlauf = Stichverlauf.aus(List.of(STICH_SUED, STICH_NORD));
        assertEquals(STICH_NORD, verlauf.letzter());
    }

    @Test
    void letzter_wirftIllegalState_wennVerlaufLeer() {
        // Warum wichtig: Aufruf auf leerem Verlauf waere ein Logikfehler im Spielfluss
        // (vor dem ersten Stich). IllegalState statt NPE macht die Fehlerursache klar.
        Stichverlauf leer = Stichverlauf.leer();
        assertThrows(IllegalStateException.class, leer::letzter);
    }

    // =========================================================================
    // istLeer() und anzahl()
    // =========================================================================

    @Test
    void istLeer_gibFalsch_nachEinemStich() {
        // Warum wichtig: istLeer() steuert Abfragen wie "darf letzter() aufgerufen werden"
        // und wird in Spielende-Checks genutzt.
        assertFalse(Stichverlauf.leer().mitStich(STICH_SUED).istLeer());
    }

    @Test
    void anzahl_stechtNachJedemHinzugefuegtemStich() {
        Stichverlauf verlauf = Stichverlauf.leer();
        for (int i = 1; i <= 3; i++) {
            verlauf = verlauf.mitStich(Stich.neu(SpielerPosition.SUED));
            assertEquals(i, verlauf.anzahl());
        }
    }

    // =========================================================================
    // equals() und hashCode()
    // =========================================================================

    @Test
    void equals_gibtTrue_beiSelbstvergleich() {
        // Warum wichtig: equals-Identitaets-Kurzschluss (this == o) muss greifen
        // um teure Listenvergleiche zu vermeiden und Reflexivitaet zu garantieren.
        Stichverlauf verlauf = Stichverlauf.aus(List.of(STICH_SUED));
        assertEquals(verlauf, verlauf);
    }

    @Test
    void equals_gibtTrue_fuerGleicheStichListe() {
        // Warum wichtig: Wertgleichheit (nicht Referenzgleichheit) ist Kerneigenschaft
        // eines Value Objects — zwei unabhaengige Instanzen mit gleichen Daten muessen gleich sein.
        Stichverlauf a = Stichverlauf.aus(List.of(STICH_SUED, STICH_NORD));
        Stichverlauf b = Stichverlauf.aus(List.of(STICH_SUED, STICH_NORD));
        assertEquals(a, b);
    }

    @Test
    void equals_gibtFalsch_fuerUnterschiedlicheStichListen() {
        // Warum wichtig: Ungleiche Verlaeufe muessen unterscheidbar sein —
        // z.B. beim Vergleich von Snapshots im Frontend.
        Stichverlauf a = Stichverlauf.aus(List.of(STICH_SUED));
        Stichverlauf b = Stichverlauf.aus(List.of(STICH_NORD));
        assertNotEquals(a, b);
    }

    @Test
    void equals_gibtFalsch_fuerNull() {
        assertNotEquals(Stichverlauf.leer(), null);
    }

    @Test
    void equals_gibtFalsch_fuerAnderenTyp() {
        // Warum wichtig: instanceof-Pruefung in equals() muss Typ-Inkompatibilitaet
        // korrekt abweisen, sonst ClassCastException an unerwarteter Stelle.
        assertNotEquals(Stichverlauf.leer(), "kein Stichverlauf");
    }

    @Test
    void hashCode_istGleich_fuerGleicheInstanzen() {
        // Warum wichtig: hashCode-Kontrakt — gleiche Objekte muessen gleichen Hash haben.
        // Bruch wuerde HashMap/HashSet-Verwendung von Stichverlauf-Schluesseln korrumpieren.
        Stichverlauf a = Stichverlauf.aus(List.of(STICH_SUED));
        Stichverlauf b = Stichverlauf.aus(List.of(STICH_SUED));
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void hashCode_leererVerlaufHatReproduzierbarHashCode() {
        assertEquals(Stichverlauf.leer().hashCode(), Stichverlauf.leer().hashCode());
    }

    // =========================================================================
    // toString()
    // =========================================================================

    @Test
    void toString_enthaeltAnzahlDerStiche() {
        // Warum wichtig: toString wird in Logmeldungen und Fehler-Diagnosen eingesetzt.
        // Das Format "Stichverlauf[anzahl=N]" muss die korrekte Zahl enthalten.
        Stichverlauf verlauf = Stichverlauf.aus(List.of(STICH_SUED, STICH_NORD));
        assertTrue(verlauf.toString().contains("2"),
            "toString() muss die Anzahl 2 enthalten: " + verlauf);
    }
}
