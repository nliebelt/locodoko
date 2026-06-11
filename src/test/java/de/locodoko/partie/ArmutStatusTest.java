package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit-Tests fuer den ArmutStatus-Record (Zustandsautomat des Armut-Tauschs).
 *
 * <p>Prueft den Compact-Constructor (Validierungsregeln), die Factory-Methode
 * {@code gestartet}, alle Zustandsuebergaenge (mitAngebot, mitAblehnung, mitPartner)
 * sowie die Abfrage-Methoden (aktuellerAntwortspieler, angebotLiegtVor,
 * alleAntwortenErschoepft, partner). Diese Methoden sind in den bestehenden
 * Integrationstests (ArmutTest) nur implizit abgedeckt.</p>
 */
class ArmutStatusTest {

    private static final List<SpielerPosition> DREI_PARTNER =
        List.of(SpielerPosition.NORD, SpielerPosition.OST, SpielerPosition.SUED);

    private final Karte karoBube1 = new Karte(Farbe.KARO, Kartenwert.BUBE, 1);
    private final Karte karoBube2 = new Karte(Farbe.KARO, Kartenwert.BUBE, 2);

    // =========================================================================
    // Compact-Constructor-Validierung
    // =========================================================================

    @Test
    void constructor_wirftNPE_wennArmutSpielerNull() {
        // Warum wichtig: Null-armutSpieler wuerde in aktuellerAntwortspieler()
        // und mitAblehnung() zu NullPointerExceptions an unerwarteten Stellen fuehren.
        assertThrows(NullPointerException.class, () ->
            new ArmutStatus(null, DREI_PARTNER, 0, List.of(), false, null));
    }

    @Test
    void constructor_wirftNPE_wennAbfrageReihenfolgeNull() {
        // Warum wichtig: Null-Liste macht List.size() unaufrufbar und verhindert
        // korrekte Grenzpruefungen in alleAntwortenErschoepft().
        assertThrows(NullPointerException.class, () ->
            new ArmutStatus(SpielerPosition.WEST, null, 0, List.of(), false, null));
    }

    @Test
    void constructor_wirftNPE_wennAngeboteneTrumpfkartenNull() {
        // Warum wichtig: Null-Karten wuerden bei nimmArmutAn den Tausch korrumpieren.
        assertThrows(NullPointerException.class, () ->
            new ArmutStatus(SpielerPosition.WEST, DREI_PARTNER, 0, null, false, null));
    }

    @Test
    void constructor_wirftIllegalArgument_wennAbfrageReihenfolgeZweiElemente() {
        // Warum wichtig: Immer genau drei potentielle Partner (die anderen drei Spieler).
        // Eine kuerzere Liste wuerde den Einwurf-Trigger (alle drei ablehnen) brechen.
        List<SpielerPosition> zweiSpieler = List.of(SpielerPosition.NORD, SpielerPosition.OST);
        assertThrows(IllegalArgumentException.class, () ->
            new ArmutStatus(SpielerPosition.WEST, zweiSpieler, 0, List.of(), false, null));
    }

    @Test
    void constructor_wirftIllegalArgument_wennAktuellerIndexNegativ() {
        // Warum wichtig: Negativer Index wuerde in List.get() eine IndexOutOfBoundsException
        // statt einer erklaerenden IllegalArgumentException ausloesen.
        assertThrows(IllegalArgumentException.class, () ->
            new ArmutStatus(SpielerPosition.WEST, DREI_PARTNER, -1, List.of(), false, null));
    }

    @Test
    void constructor_wirftIllegalArgument_wennAktuellerIndexGroesserAlsListengroesse() {
        // Warum wichtig: Index 4 bei Liste der Groesse 3 ist kein gueltiger Abbruch-Sentinel
        // (gueltiger Abbruch ist genau 3 = Listengroesse). Ein hoeherer Index maskiert
        // Programmierfehler statt sie fruehzeitig zu melden.
        assertThrows(IllegalArgumentException.class, () ->
            new ArmutStatus(SpielerPosition.WEST, DREI_PARTNER, 4, List.of(), false, null));
    }

    @Test
    void constructor_erlaubtAktuellerIndexGleichListengroesse() {
        // Warum wichtig: Index == Listengroesse (3) ist der gueltige Erschoepfungszustand
        // nach der dritten Ablehnung. Der Constraint ist "aktuellerIndex <= size()", nicht "<".
        assertDoesNotThrow(() ->
            new ArmutStatus(SpielerPosition.WEST, DREI_PARTNER, 3, List.of(), true, null));
    }

    @Test
    void constructor_wirftIllegalArgument_wennPartnerOhneAbgegebenesAngebot() {
        // Warum wichtig: Ein Partner kann nur gesetzt werden, nachdem der Armut-Spieler
        // sein Angebot abgegeben hat. Anderenfalls laege ein inkonsistenter Zwischenzustand
        // vor (Partner bekannt, aber noch keine Karten zum Tauschen vorhanden).
        assertThrows(IllegalArgumentException.class, () ->
            new ArmutStatus(SpielerPosition.WEST, DREI_PARTNER, 0, List.of(), false, SpielerPosition.NORD));
    }

    // =========================================================================
    // gestartet() Factory-Methode
    // =========================================================================

    @Test
    void gestartet_wirftNPE_wennArmutSpielerNull() {
        // Warum wichtig: null-Eingabe muss fruehzeitig abgefangen werden, nicht erst
        // beim ersten Methodenaufruf auf dem zurueckgegebenen Objekt.
        assertThrows(NullPointerException.class, () -> ArmutStatus.gestartet(null));
    }

    @Test
    void gestartet_mitWest_liefertKorrekteAbfragenReihenfolge() {
        // Warum wichtig: Der Uhrzeigersinn-Startpunkt haengt von der Position des
        // Armut-Spielers ab. Fuer WEST beginnt die Abfrage bei NORD (linker Nachbar)
        // und geht weiter zu OST und SUED. Ein Fehler hier wuerde den falschen Spieler
        // zuerst befragen und den Ablauf-Vertrag korrumpieren.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);

        assertEquals(List.of(SpielerPosition.NORD, SpielerPosition.OST, SpielerPosition.SUED),
            status.abfrageReihenfolge(), "Abfrage-Reihenfolge fuer WEST muss mit NORD beginnen.");
    }

    @Test
    void gestartet_mitSued_liefertKorrekteAbfragenReihenfolge() {
        // Warum wichtig: Prueft die Uhrzeigersinn-Logik fuer eine andere Startposition.
        // Fuer SUED beginnt die Abfrage bei WEST.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.SUED);

        assertEquals(List.of(SpielerPosition.WEST, SpielerPosition.NORD, SpielerPosition.OST),
            status.abfrageReihenfolge(), "Abfrage-Reihenfolge fuer SUED muss mit WEST beginnen.");
    }

    @Test
    void gestartet_hatKorrekteInitialzustand() {
        // Warum wichtig: Jedes Feld des Anfangszustands muss stimmen, damit alle
        // darauf aufbauenden Zustandsuebergaenge korrekt starten.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);

        assertEquals(0, status.aktuellerIndex(), "Anfangs-Index muss 0 sein.");
        assertEquals(List.of(), status.angeboteneTrumpfkarten(), "Anfangs sind keine Karten angeboten.");
        assertFalse(status.angebotAbgegeben(), "Angebot darf initial noch nicht abgegeben sein.");
        assertNull(status.partnerSpieler(), "Anfangs ist kein Partner gesetzt.");
    }

    // =========================================================================
    // Abfrage-Methoden im Initialzustand
    // =========================================================================

    @Test
    void aktuellerAntwortspieler_istLeer_vorAngebot() {
        // Warum wichtig: Bevor der Armut-Spieler seine Karten angeboten hat, darf
        // kein Antwortspieler aktiviert sein – die Abfrage-Runde beginnt erst danach.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);
        assertEquals(Optional.empty(), status.aktuellerAntwortspieler());
    }

    @Test
    void angebotLiegtVor_istFalsch_initial() {
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);
        assertFalse(status.angebotLiegtVor());
    }

    @Test
    void alleAntwortenErschoepft_istFalsch_initial() {
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);
        assertFalse(status.alleAntwortenErschoepft());
    }

    @Test
    void partner_istLeer_initial() {
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);
        assertEquals(Optional.empty(), status.partner());
    }

    // =========================================================================
    // mitAngebot()
    // =========================================================================

    @Test
    void mitAngebot_wirftNPE_wennKartenNull() {
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);
        assertThrows(NullPointerException.class, () -> status.mitAngebot(null));
    }

    @Test
    void mitAngebot_setztAngebotAbgegeben_undAktuellerAntwortspielerIstNord() {
        // Warum wichtig: Nach dem Angebot muss der erste potentielle Partner (NORD)
        // als Antwortspieler gesetzt sein. Fehlt dieser Uebergang, kann niemand antworten.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);
        List<Karte> angebotene = List.of(karoBube1, karoBube2);

        ArmutStatus nachAngebot = status.mitAngebot(angebotene);

        assertTrue(nachAngebot.angebotLiegtVor(), "Nach mitAngebot muss angebotLiegtVor wahr sein.");
        assertEquals(Optional.of(SpielerPosition.NORD), nachAngebot.aktuellerAntwortspieler(),
            "Erster Antwortspieler fuer WEST-Armut muss NORD sein.");
        assertEquals(angebotene, nachAngebot.angeboteneTrumpfkarten(), "Karten muessen uebernommen werden.");
    }

    @Test
    void mitAngebot_wirftIllegalState_wennDoppeltAufgerufen() {
        // Warum wichtig: Ein zweites Angebot wuerde die urspruenglichen Karten ueberschreiben
        // und die Abfrage-Runde neu starten – ein inkonsistenter Zustand, der die Tausch-
        // Korrektheit bei nimmArmutAn gefaehrdet.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(karoBube1));

        assertThrows(IllegalStateException.class, () -> status.mitAngebot(List.of(karoBube2)));
    }

    // =========================================================================
    // mitAblehnung()
    // =========================================================================

    @Test
    void mitAblehnung_wirftNPE_wennPositionNull() {
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST).mitAngebot(List.of(karoBube1));
        assertThrows(NullPointerException.class, () -> status.mitAblehnung(null));
    }

    @Test
    void mitAblehnung_wirftIllegalState_ohneAngebot() {
        // Warum wichtig: Ablehnung ist nur sinnvoll, wenn ein Angebot vorliegt.
        // Ohne diese Pruefung koennte der Index voranschreiten, ohne dass ein Angebot gemacht wurde.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);
        assertThrows(IllegalStateException.class, () -> status.mitAblehnung(SpielerPosition.NORD));
    }

    @Test
    void mitAblehnung_wirftIllegalState_wennFalscherSpieler() {
        // Warum wichtig: Nur der aktuell befragte Spieler darf ablehnen.
        // Ein falscher Spieler wuerde den Index um 1 verschieben, ohne den richtigen Spieler befragt zu haben.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST).mitAngebot(List.of(karoBube1));
        // Erster Antwortspieler ist NORD, OST ist daher falsch
        assertThrows(IllegalStateException.class, () -> status.mitAblehnung(SpielerPosition.OST));
    }

    @Test
    void mitAblehnung_ersteAblehnung_naechsterAntwortspielerIstOst() {
        // Warum wichtig: Nach NORD's Ablehnung muss der naechste Spieler (OST) dran sein.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(karoBube1))
            .mitAblehnung(SpielerPosition.NORD);

        assertEquals(Optional.of(SpielerPosition.OST), status.aktuellerAntwortspieler());
        assertFalse(status.alleAntwortenErschoepft());
    }

    @Test
    void mitAblehnung_zweiteAblehnung_naechsterAntwortspielerIstSued() {
        // Warum wichtig: Sequenzielles Durchlaufen aller drei Ablehnungen muss den Index
        // korrekt inkrementieren. Ein Off-by-One liesse einen Spieler ueberspringen.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(karoBube1))
            .mitAblehnung(SpielerPosition.NORD)
            .mitAblehnung(SpielerPosition.OST);

        assertEquals(Optional.of(SpielerPosition.SUED), status.aktuellerAntwortspieler());
    }

    @Test
    void mitAblehnung_alledreiAbgelehnt_antwortenErschoepft() {
        // Warum wichtig: Nach drei Ablehnungen muss alleAntwortenErschoepft() wahr sein,
        // damit SpielArmutTausch den Einwurf ausloest. Fehlt dieser Zustand, haengt das Spiel.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(karoBube1))
            .mitAblehnung(SpielerPosition.NORD)
            .mitAblehnung(SpielerPosition.OST)
            .mitAblehnung(SpielerPosition.SUED);

        assertTrue(status.alleAntwortenErschoepft(), "Nach drei Ablehnungen muessen alle Antworten erschoepft sein.");
        assertEquals(Optional.empty(), status.aktuellerAntwortspieler(), "Kein Antwortspieler mehr nach drei Ablehnungen.");
        assertEquals(Optional.empty(), status.partner(), "Kein Partner nach drei Ablehnungen.");
    }

    @Test
    void mitAblehnung_wirftIllegalState_nachErschoepfung() {
        // Warum wichtig: Nach Erschoepfung aller Antworten darf keine weitere Ablehnung moeglich sein.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(karoBube1))
            .mitAblehnung(SpielerPosition.NORD)
            .mitAblehnung(SpielerPosition.OST)
            .mitAblehnung(SpielerPosition.SUED);

        assertThrows(IllegalStateException.class, () -> status.mitAblehnung(SpielerPosition.NORD));
    }

    // =========================================================================
    // mitPartner()
    // =========================================================================

    @Test
    void mitPartner_wirftNPE_wennPositionNull() {
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST).mitAngebot(List.of(karoBube1));
        assertThrows(NullPointerException.class, () -> status.mitPartner(null));
    }

    @Test
    void mitPartner_wirftIllegalState_ohneAngebot() {
        // Warum wichtig: Ein Partner kann nicht gesetzt werden, wenn noch kein Angebot vorliegt
        // (kein Antwortspieler aktiv). Fehlt diese Pruefung, waere der Partner-Zustand
        // inkonsistent mit dem Angebot-Zustand.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);
        assertThrows(IllegalStateException.class, () -> status.mitPartner(SpielerPosition.NORD));
    }

    @Test
    void mitPartner_wirftIllegalState_wennFalscherSpieler() {
        // Warum wichtig: Nur der aktuell befragte Spieler darf annehmen.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST).mitAngebot(List.of(karoBube1));
        // Erster Antwortspieler ist NORD; OST darf nicht annehmen
        assertThrows(IllegalStateException.class, () -> status.mitPartner(SpielerPosition.OST));
    }

    @Test
    void mitPartner_setztPartnerKorrekt() {
        // Warum wichtig: Nach der Annahme muss der richtige Spieler als Partner gesetzt sein,
        // damit SpielArmutTausch die RE-Parteizuordnung korrekt durchfuehren kann.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(karoBube1))
            .mitPartner(SpielerPosition.NORD);

        assertEquals(Optional.of(SpielerPosition.NORD), status.partner(),
            "NORD muss als Partner eingetragen sein.");
        assertEquals(Optional.empty(), status.aktuellerAntwortspieler(),
            "Nach gesetztem Partner darf kein weiterer Antwortspieler aktiviert sein.");
        assertFalse(status.alleAntwortenErschoepft(),
            "alleAntwortenErschoepft muss falsch sein, wenn ein Partner gefunden wurde.");
    }

    @Test
    void mitPartner_nachErsterAblehnung_setztZweitenSpielerAlsPartner() {
        // Warum wichtig: Annahme nach einer Ablehnung muss den zweiten Spieler (OST) als Partner setzen.
        // Prueft, dass der Index-Fortschritt nach Ablehnung korrekt mit der Partner-Auswahl interagiert.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(karoBube1))
            .mitAblehnung(SpielerPosition.NORD)
            .mitPartner(SpielerPosition.OST);

        assertEquals(Optional.of(SpielerPosition.OST), status.partner(),
            "OST muss nach NORDs Ablehnung als Partner moeglich sein.");
    }

    @Test
    void mitPartner_wirftIllegalState_nachErschoepfung() {
        // Warum wichtig: Nach allen Ablehnungen gibt es keinen gueltigen Antwortspieler mehr.
        // Sicherheitsnetz, damit kein Partner in einen Einwurf-Zustand gesetzt werden kann.
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(karoBube1))
            .mitAblehnung(SpielerPosition.NORD)
            .mitAblehnung(SpielerPosition.OST)
            .mitAblehnung(SpielerPosition.SUED);

        assertThrows(IllegalStateException.class, () -> status.mitPartner(SpielerPosition.NORD));
    }
}
