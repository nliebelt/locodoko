package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit-Tests fuer die Hochzeit-Sonderregel.
 *
 * <p>Prueft Erkennung (T1.1), Partnersuche (T1.2), stilles Solo (T1.3),
 * Ansage-Einschraenkungen waehrend der Klaerungsphase (T1.4) sowie das
 * Zusammenspiel mit der Dreissig-Augen-Pflicht-Regel (T1.5).</p>
 */
class HochzeitTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();

    // --- T1.1: Erkennung ---

    @Test
    void hochzeitErkannt_BeiBeideKreuzDamen() {
        // Warum wichtig: Nur wenn beide Kreuz-Damen auf einer Hand liegen, darf Hochzeit als
        // Vorbehalt zugelassen werden. Dieser Test sichert die Eingangspruefung von
        // VorbehaltAnsage.HOCHZEIT ab — ohne sie koennte jede Hand faelschlich Hochzeit
        // anmelden und die Parteibildung korrumpieren.
        Hand hand = new Hand(List.of(
            new Karte(Farbe.KREUZ, Kartenwert.DAME, 1),
            new Karte(Farbe.KREUZ, Kartenwert.DAME, 2)
        ));
        assertTrue(VorbehaltAnsage.HOCHZEIT.istZulaessig(hand, spielregeln),
            "Beide Kreuz-Damen auf einer Hand muessen Hochzeit als Vorbehalt zulassen.");
    }

    @Test
    void hochzeitAbgelehnt_BeiNurEinerKreuzDame() {
        // Warum wichtig: Eine einzelne Kreuz-Dame bedeutet normales Re-Spiel — kein
        // Hochzeit-Vorbehalt. Falsch-positive wuerden die Parteibildung korrumpieren.
        Hand hand = new Hand(List.of(
            new Karte(Farbe.KREUZ, Kartenwert.DAME, 1)
        ));
        assertFalse(VorbehaltAnsage.HOCHZEIT.istZulaessig(hand, spielregeln),
            "Eine einzelne Kreuz-Dame darf Hochzeit nicht ausloesen.");
    }

    @Test
    void hochzeitAbgelehnt_BeiDeaktivierterRegel() {
        // Warum wichtig: Die Tischkonfiguration muss Hochzeit serverseitig sperren koennen,
        // damit Frontend und Backend dieselbe Regelbasis teilen.
        Spielregeln ohneHochzeit = spielregeln.mitHochzeitAktiv(false);
        Hand hand = new Hand(List.of(
            new Karte(Farbe.KREUZ, Kartenwert.DAME, 1),
            new Karte(Farbe.KREUZ, Kartenwert.DAME, 2)
        ));
        assertFalse(VorbehaltAnsage.HOCHZEIT.istZulaessig(hand, ohneHochzeit),
            "Deaktivierte Hochzeit-Regel muss auch bei beiden Kreuz-Damen abgelehnt werden.");
    }

    // --- T1.2: Partnersuche ---

    @Test
    void mitGeklaertemStich_FindetPartner_BeimErstenFremdenGewinner() {
        // Warum wichtig: Der erste Stichgewinner, der nicht der Hochzeit-Spieler selbst ist,
        // wird sofort zum Re-Partner. Dieser Unit-Test sichert den Zustandsautomaten von
        // HochzeitStatus.mitGeklaertemStich() direkt ab — ohne Umweg durch Spiel.
        HochzeitStatus status = HochzeitStatus.gestartet(SpielerPosition.WEST);
        HochzeitStatus nachStich = status.mitGeklaertemStich(SpielerPosition.NORD);

        assertFalse(nachStich.suchtPartner(),
            "Sobald ein Partner gefunden ist, darf die Suche nicht mehr aktiv sein.");
        assertEquals(SpielerPosition.NORD, nachStich.partner().orElseThrow(),
            "Der erste fremde Stichgewinner muss exakt als Partner eingetragen sein.");
        assertFalse(nachStich.stillesSolo(),
            "Ein gefundener Partner schliesst stilles Solo aus.");
        assertEquals(1, nachStich.geklaerteStiche(),
            "Genau ein Klaerungsstich muss gezaehlt sein.");
    }

    @Test
    void mitGeklaertemStich_KeinPartner_WennHochzeitSpielerSelbstGewinnt() {
        // Warum wichtig: Der Hochzeit-Spieler zaehlt nicht als eigener Partner — gewinnt er,
        // laeuft die Suche weiter. Ohne diesen Test koennte ein eigener Klaerungsstich die
        // Partnersuche faelschlich beenden und die Parteizuordnung falsch setzen.
        HochzeitStatus status = HochzeitStatus.gestartet(SpielerPosition.WEST);
        HochzeitStatus nachEigenemStich = status.mitGeklaertemStich(SpielerPosition.WEST);

        assertTrue(nachEigenemStich.suchtPartner(),
            "Nach eigenem Stichgewinn muss die Partnersuche weiterlaufen.");
        assertFalse(nachEigenemStich.partner().isPresent(),
            "Kein Partner darf nach eigenem Stich gesetzt sein.");
        assertEquals(1, nachEigenemStich.geklaerteStiche(),
            "Geklaerte Stiche muessen inkrementiert werden, auch wenn kein Partner gefunden wird.");
    }

    // --- T1.3: Stilles Solo ---

    @Test
    void mitGeklaertemStich_LoestStillesSoloAus_NachDreiEigenenStichenOhnePartner() {
        // Warum wichtig: Findet der Hochzeit-Spieler in drei Klaerungsstichen keinen Partner,
        // wechselt die Hochzeit in ein stilles Solo (Hochzeit-Spieler allein gegen alle drei).
        // Dieser Unit-Test sichert den Zustandsautomaten von HochzeitStatus direkt ab —
        // die Korrektheit haengt ausschliesslich an der Zaehlergrenze 3.
        HochzeitStatus status = HochzeitStatus.gestartet(SpielerPosition.WEST);
        status = status.mitGeklaertemStich(SpielerPosition.WEST); // Klaerungsstich 1
        status = status.mitGeklaertemStich(SpielerPosition.WEST); // Klaerungsstich 2
        status = status.mitGeklaertemStich(SpielerPosition.WEST); // Klaerungsstich 3 → stilles Solo

        assertTrue(status.stillesSolo(),
            "Nach drei eigenen Klaerungsstichen muss stilles Solo aktiv sein.");
        assertFalse(status.suchtPartner(),
            "Stilles Solo beendet die Partnersuche endgueltig.");
        assertFalse(status.partner().isPresent(),
            "Kein Partner darf im stillen Solo gesetzt sein.");
        assertEquals(3, status.geklaerteStiche(),
            "Genau drei Klaerungsstiche muessen gezaehlt sein.");
    }

    @Test
    void mitGeklaertemStich_KeineWeitereAenderung_NachPartnerFund() {
        // Warum wichtig: Nach Partnerfindung ist der Status abgeschlossen und muss immutabel
        // bleiben. Weitere Aufrufe duerfen den Status nicht veraendern — das Record-Verhalten
        // (suchtPartner() = false → fruehe Rueckgabe von this) muss explizit gesichert sein.
        HochzeitStatus status = HochzeitStatus.gestartet(SpielerPosition.WEST)
            .mitGeklaertemStich(SpielerPosition.NORD);  // Partner gefunden
        HochzeitStatus nachWeiteremStich = status.mitGeklaertemStich(SpielerPosition.OST);

        assertSame(status, nachWeiteremStich,
            "Nach Partnerfindung muss mitGeklaertemStich dieselbe Instanz zurueckgeben (kein Zustandswechsel mehr).");
    }

    // --- T1.4: Ansagen waehrend Partnersuche ---

    @Test
    void kannAnsagen_KontragegnerGesperrt_WaehrendPartnersuche() {
        // Warum wichtig: Waehrend die Hochzeit noch einen Partner sucht, wuerde eine
        // KONTRA-Ansage die Parteizugehoerigkeit offenbaren, bevor klar ist, wer zur
        // KONTRA-Partei gehoert. Die Hochzeit-Einschraenkung muss unabhaengig vom normalen
        // Ansage-Zeitfenster (= nur aktueller Spieler) greifen.
        Spiel spiel = hochzeitSpielNachVorbehaltsaufloesung();
        // WEST (Hochzeit-Spieler) spielt erste Karte → NORD wird naechster Spieler (erwarteterSpieler)
        spiel.spieleKarte(SpielerPosition.WEST, spiel.gueltigeKartenFuer(SpielerPosition.WEST).getFirst());

        assertTrue(spiel.hochzeitStatus().orElseThrow().suchtPartner(),
            "Hochzeit muss nach dem ersten Zug des Hochzeit-Spielers noch einen Partner suchen.");
        assertFalse(spiel.kannAnsagen(SpielerPosition.NORD, Ansage.KONTRA),
            "KONTRA-Ansage eines potentiellen Partners muss gesperrt sein, solange die Partei ungeklaert ist.");
        assertFalse(spiel.kannAnsagen(SpielerPosition.OST, Ansage.KONTRA),
            "Auch andere Nicht-Hochzeit-Spieler sind waehrend der Partnersuche von Ansagen ausgeschlossen.");
    }

    @Test
    void kannAnsagen_HochzeitSpielerDarfRe_WaehrendPartnersuche() {
        // Warum wichtig: Der Hochzeit-Spieler selbst ist von Beginn an RE und darf seine
        // Partei ansagen — er ist die einzige Ausnahme der Hochzeit-Einschraenkung.
        // Wird er ebenfalls gesperrt, verliert RE im schlimmsten Fall das gesamte Ansagefenster.
        Spiel spiel = hochzeitSpielNachVorbehaltsaufloesung();

        assertTrue(spiel.hochzeitStatus().orElseThrow().suchtPartner());
        assertTrue(spiel.kannAnsagen(SpielerPosition.WEST, Ansage.RE),
            "Der Hochzeit-Spieler muss RE ansagen koennen, auch waehrend er noch einen Partner sucht.");
    }

    // --- T1.5: Hochzeit + Dreissig-Augen-Pflicht ---

    @Test
    void dreissigAugenPflicht_WirdAusgeloest_InHochzeitSpiel() {
        // Warum wichtig: Die Dreissig-Augen-Pflicht gilt explizit auch bei HOCHZEIT (nicht nur
        // NORMALSPIEL — Spiel.java prueft: spieltyp != NORMALSPIEL && spieltyp != HOCHZEIT).
        // Ohne diesen Test koennte der HOCHZEIT-Zweig still herausfallen und den Mechanismus in
        // einer der haeufigsten Sonderregel-Kombinationen unbemerkt deaktivieren.
        Spielregeln mitPflicht = spielregeln.mitDreissigAugenPflichtAktiv(true);

        // Stich 1: WEST spielt Kreuz-Dame (Trumpf, 3 Augen), NORD/OST/SUED spielen hohe Fehlfarbe.
        // Gesamt: 3+11+11+10 = 35 Augen. WEST (RE, Hochzeit-Spieler allein) gewinnt.
        Karte kreuzDame    = new Karte(Farbe.KREUZ, Kartenwert.DAME,   1);  // Aufspieler-Trumpf, 3A
        Karte nordKarte    = new Karte(Farbe.KREUZ, Kartenwert.AS,     1);  // 11 Augen, Fehlfarbe
        Karte ostKarte     = new Karte(Farbe.PIK,   Kartenwert.AS,     1);  // 11 Augen, Fehlfarbe
        Karte suedKarte    = new Karte(Farbe.PIK,   Kartenwert.ZEHN,   1);  // 10 Augen, Fehlfarbe

        Spiel spiel = spieleViertaKarteImHochzeitStich(
            mitPflicht,
            SpielerPosition.WEST,   // Aufspieler und Hochzeit-Spieler
            kreuzDame, nordKarte, ostKarte,
            SpielerPosition.SUED, suedKarte
        );

        assertTrue(spiel.pflichtansageAusstehend().contains(Partei.RE),
            "Nach Stich 1 mit 35 Augen (> 30) muss die RE-Partei eine Pflichtansage machen — " +
            "auch im Hochzeit-Spieltyp.");
        assertFalse(spiel.pflichtansageAusstehend().contains(Partei.KONTRA),
            "KONTRA hat den Stich nicht gewonnen und braucht keine Pflichtansage.");
    }

    @Test
    void dreissigAugenPflicht_NutztAktualisierteParteien_BeiHochzeitPartnerBestimmung() {
        // Warum wichtig (BUG-1): Wenn ein fremder Spieler den ersten Stich mit >30 Augen gewinnt
        // und dadurch Hochzeit-Partner (RE) wird, muss die Pflichtansage fuer RE gelten (die
        // aktualisierte Partei des Stichgewinners). Vor dem Fix wurde die Pflichtansage mit den
        // alten Parteien berechnet — der Stichgewinner war dort noch KONTRA. Das fuehrte zu einer
        // Pflichtansage fuer KONTRA, obwohl der fuehrende Spieler jetzt RE ist. Die KI konnte die
        // Pflichtansage nicht erfuellen und das Spiel hing.
        Spielregeln mitPflicht = spielregeln.mitDreissigAugenPflichtAktiv(true);

        // Stich 1: WEST (Hochzeit) spielt niedrigen Trumpf, NORD gewinnt mit Dulle (Herz 10).
        // NORD wird dadurch Hochzeit-Partner (RE). Gesamt: 4+10+11+10 = 35 Augen (> 30).
        Karte westKarte = new Karte(Farbe.KARO,  Kartenwert.KOENIG, 1); // 4A, Trumpf
        Karte nordKarte = new Karte(Farbe.HERZ,  Kartenwert.ZEHN,   1); // 10A, Dulle (hoechster Trumpf)
        Karte ostKarte  = new Karte(Farbe.KARO,  Kartenwert.AS,     1); // 11A, Trumpf (Fuchs)
        Karte suedKarte = new Karte(Farbe.KARO,  Kartenwert.ZEHN,   1); // 10A, Trumpf

        Spiel nachStich = spieleViertaKarteImHochzeitStich(
            mitPflicht,
            SpielerPosition.WEST,   // Aufspieler und Hochzeit-Spieler
            westKarte, nordKarte, ostKarte,
            SpielerPosition.SUED, suedKarte
        );

        // NORD hat den Stich gewonnen und ist jetzt RE-Partner
        assertFalse(nachStich.hochzeitStatus().orElseThrow().suchtPartner(),
            "Nach erstem fremden Stichgewinn darf die Partnersuche nicht mehr aktiv sein.");
        assertEquals(SpielerPosition.NORD, nachStich.hochzeitStatus().orElseThrow().partner().orElseThrow(),
            "NORD muss als Hochzeit-Partner eingetragen sein.");

        // Die Pflichtansage muss fuer RE gelten (NORDs AKTUELLE Partei), nicht KONTRA (alte Partei)
        assertTrue(nachStich.pflichtansageAusstehend().contains(Partei.RE),
            "Pflichtansage muss fuer RE gelten — NORD ist nach Partnerbestimmung RE, nicht mehr KONTRA.");
        assertFalse(nachStich.pflichtansageAusstehend().contains(Partei.KONTRA),
            "KONTRA darf nicht in pflichtansageAusstehend stehen — NORD ist jetzt RE.");

        // NORD fuehrt Stich 2 und muss RE ansagen koennen (Pflichtansage erfuellbar)
        assertTrue(nachStich.kannAnsagen(SpielerPosition.NORD, Ansage.RE),
            "NORD (jetzt RE) muss die Pflichtansage RE machen koennen.");

        // Nach der Pflichtansage muss spieleKarte wieder moeglich sein (Spiel nicht blockiert)
        nachStich.sageAn(SpielerPosition.NORD, Ansage.RE);
        assertTrue(nachStich.pflichtansageAusstehend().isEmpty(),
            "Nach RE-Ansage muss die Pflichtansage erfuellt sein.");
    }

    // --- Hilfsmethoden ---

    /**
     * Erstellt ein Hochzeit-Spiel nach loeseVorbehalteAuf() mit Standard-Spielregeln.
     * WEST ist Hochzeit-Spieler (hat beide Kreuz-Damen), SUED ist Geber, WEST ist Aufspieler.
     */
    private Spiel hochzeitSpielNachVorbehaltsaufloesung() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    new Karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    new Karte(Farbe.KREUZ, Kartenwert.DAME, 2)
                )
            )));
        spiel.teileKartenAus();
        spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT);
        spiel.meldeGesund(SpielerPosition.NORD);
        spiel.meldeGesund(SpielerPosition.OST);
        spiel.meldeGesund(SpielerPosition.SUED);
        spiel.loeseVorbehalteAuf();
        return spiel;
    }

    /**
     * Spielt die vierte Karte im ersten Stich eines Hochzeit-Spiels (drei Karten bereits gespielt).
     * Nutzt Spiel.ausPersistiertemStand() mit Spieltyp HOCHZEIT und WEST als Hochzeit-Spieler.
     * Parteien: WEST=RE (allein), NORD/OST/SUED=KONTRA — wie zu Beginn einer Hochzeit.
     */
    private Spiel spieleViertaKarteImHochzeitStich(
        Spielregeln regeln,
        SpielerPosition aufspieler,
        Karte karte1, Karte karte2, Karte karte3,
        SpielerPosition vierterSpieler,
        Karte karte4
    ) {
        SpielerPosition spieler2 = aufspieler.naechsteImUhrzeigersinn();
        SpielerPosition spieler3 = spieler2.naechsteImUhrzeigersinn();

        Stich laufenderStich = Stich.ausPersistiertemStand(aufspieler, List.of(
            new GespielteKarte(aufspieler, karte1, 1),
            new GespielteKarte(spieler2,   karte2, 2),
            new GespielteKarte(spieler3,   karte3, 3)
        ));

        EnumMap<SpielerPosition, Hand> haende = new EnumMap<>(SpielerPosition.class);
        haende.put(vierterSpieler, new Hand(List.of(karte4)));

        // Dummy-Karten damit das Spiel nach dem Stich nicht sofort in AUSWERTUNG wechselt
        List<Karte> alleKarten = new ArrayList<>(List.of(karte1, karte2, karte3, karte4));
        for (int i = alleKarten.size() + 1; i <= 8; i++) {
            alleKarten.add(new Karte(Farbe.KARO, Kartenwert.NEUN, i));
        }

        // Hochzeit: WEST allein RE, alle anderen KONTRA — so wie nach loeseVorbehalteAuf()
        Parteien parteien = Parteien.ausHochzeit(aufspieler);

        Spiel spiel = Spiel.ausPersistiertemStand(
            regeln,
            Kartendeck.ausKarten(alleKarten),
            Spieltyp.HOCHZEIT,
            SpielerPosition.SUED,
            new Spielphase.Stichphase(laufenderStich, Set.of(), HochzeitStatus.gestartet(aufspieler)),
            haende,
            List.of(),
            parteien,
            Ansagen.leer(),
            List.of(),
            null,
            false,
            null
        );
        spiel.spieleKarte(vierterSpieler, karte4);
        return spiel;
    }

    private Kartendeck kartendeckMitVerteiltenHaenden(Map<SpielerPosition, List<Karte>> vorgaben) {
        EnumMap<SpielerPosition, List<Karte>> haende = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            haende.put(position, new ArrayList<>(vorgaben.getOrDefault(position, List.of())));
        }

        List<Karte> restkarten = new ArrayList<>(Kartendeck.neu(spielregeln).karten());
        for (List<Karte> karten : haende.values()) {
            for (Karte karte : karten) {
                if (!restkarten.remove(karte)) {
                    throw new IllegalArgumentException("Vorgegebene Karte ist nicht verfuegbar: " + karte);
                }
            }
        }

        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            List<Karte> hand = haende.get(position);
            while (hand.size() < 12 && !restkarten.isEmpty()) {
                hand.add(restkarten.remove(0));
            }
        }

        List<Karte> deckkarten = new ArrayList<>();
        int maxKarten = 0;
        for (List<Karte> hand : haende.values()) {
            maxKarten = Math.max(maxKarten, hand.size());
        }
        for (int index = 0; index < maxKarten; index++) {
            for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
                List<Karte> hand = haende.get(position);
                if (index < hand.size()) {
                    deckkarten.add(hand.get(index));
                }
            }
        }
        return kartendeckAus(deckkarten);
    }

    private Kartendeck kartendeckAus(List<Karte> karten) {
        try {
            java.lang.reflect.Constructor<Kartendeck> konstruktor =
                Kartendeck.class.getDeclaredConstructor(java.util.Collection.class);
            konstruktor.setAccessible(true);
            return konstruktor.newInstance(karten);
        } catch (ReflectiveOperationException ausnahme) {
            throw new IllegalStateException("Kontrolliertes Kartendeck konnte nicht erzeugt werden", ausnahme);
        }
    }
}
