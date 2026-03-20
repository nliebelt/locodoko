package de.locodoko.spiel.partie;

import de.locodoko.spiel.karten.Farbe;
import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartendeck;
import de.locodoko.spiel.karten.Kartenwert;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spielregeln;
import de.locodoko.spiel.karten.Spieltyp;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SpielTest {

    private final Spielregeln spielregeln = Spielregeln.standardRegeln();
    private final PunkteRechner punkteRechner = new PunkteRechner();

    @Test
    void loestTrumpfsoloMitSitzreihenfolgeAufUndOffenbartParteienVonBeginnAn() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitKontrolliertenHaenden())
            .teileKartenAus()
            .meldeGesund(SpielerPosition.WEST)
            .meldeVorbehalt(SpielerPosition.NORD, VorbehaltAnsage.SOLO_TRUMPF)
            .meldeVorbehalt(SpielerPosition.OST, VorbehaltAnsage.SOLO_TRUMPF)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();

        assertEquals(Spieltyp.SOLO_TRUMPF, spiel.spieltyp(),
            "Das hoechste Solo muss in der Vorbehaltsaufloesung wirksam werden, damit Sonderspiele regelkonform vor dem ersten Stich starten.");
        assertEquals(Partei.RE, spiel.parteien().parteiVon(SpielerPosition.NORD));
        assertEquals(List.of(SpielerPosition.NORD), spiel.parteien().spielerVon(Partei.RE),
            "Im Trumpfsolo spielt genau ein Spieler alleine gegen drei Gegner; diese Parteibildung ist die Grundlage fuer Wertung und Ansagen.");
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.WEST, SpielerPosition.NORD).isPresent(),
            "Die Solo-Parteien muessen von Beginn an offen sein, damit UI und Ansagelogik ohne verdeckte Information arbeiten koennen.");
        assertEquals(SpielerPosition.WEST, spiel.aktuellerStich().orElseThrow().aufspieler(),
            "Auch im Solo beginnt weiterhin der Spieler links vom Geber den ersten Stich.");
    }

    @Test
    void loestHochzeitAufUndStartetMitOffenemHochzeitsSpieler() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2)
                )
            )))
            .teileKartenAus()
            .meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();

        assertEquals(Spieltyp.HOCHZEIT, spiel.spieltyp(),
            "Die Hochzeit muss als eigener Spieltyp aufloesbar sein, damit Vorbehalt-Phase und Stichphase denselben Fachzustand sehen.");
        assertEquals(List.of(SpielerPosition.WEST), spiel.parteien().spielerVon(Partei.RE),
            "Zu Beginn der Hochzeit spielt der Melder allein, bis ein fremder Stichgewinner als Partner feststeht.");
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.NORD, SpielerPosition.WEST).isPresent(),
            "Die Hochzeit ist ein offener Vorbehalt; der Hochzeits-Spieler muss daher fuer alle sichtbar sein.");
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.NORD, SpielerPosition.OST).isEmpty(),
            "Die uebrigen Parteien bleiben bis zur Klaerung verdeckt, damit die Partnersuche fachlich korrekt startet.");
        assertTrue(spiel.hochzeitStatus().orElseThrow().suchtPartner());
    }

    @Test
    void findetBeimErstenFremdenStichDenPartnerUndOffenbartDanachAlleParteien() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2),
                    karte(Farbe.KREUZ, Kartenwert.KOENIG, 1)
                ),
                SpielerPosition.NORD, List.of(karte(Farbe.KREUZ, Kartenwert.AS, 1)),
                SpielerPosition.OST, List.of(karte(Farbe.KREUZ, Kartenwert.ZEHN, 1)),
                SpielerPosition.SUED, List.of(karte(Farbe.KREUZ, Kartenwert.NEUN, 1))
            )))
            .teileKartenAus()
            .meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf()
            .spieleKarte(SpielerPosition.WEST, karte(Farbe.KREUZ, Kartenwert.KOENIG, 1))
            .spieleKarte(SpielerPosition.NORD, karte(Farbe.KREUZ, Kartenwert.AS, 1))
            .spieleKarte(SpielerPosition.OST, karte(Farbe.KREUZ, Kartenwert.ZEHN, 1))
            .spieleKarte(SpielerPosition.SUED, karte(Farbe.KREUZ, Kartenwert.NEUN, 1));

        assertEquals(List.of(SpielerPosition.WEST, SpielerPosition.NORD), spiel.parteien().spielerVon(Partei.RE),
            "Der erste fremde Stichgewinner muss sofort Partner werden, damit Augen und Sonderpunkte der richtigen Partei zufallen.");
        assertEquals(SpielerPosition.NORD, spiel.hochzeitStatus().orElseThrow().partner().orElseThrow());
        for (SpielerPosition beobachter : SpielerPosition.standardReihenfolge()) {
            for (SpielerPosition ziel : SpielerPosition.standardReihenfolge()) {
                assertTrue(spiel.parteien().sichtAufPartei(beobachter, ziel).isPresent(),
                    "Nach der Partnerfindung muessen alle Parteien offen liegen, damit keine verdeckte Restinformation zurueckbleibt.");
            }
        }
        assertEquals(SpielerPosition.NORD, spiel.aktuellerStich().orElseThrow().aufspieler());
    }

    @Test
    void wechseltNachDreiEigenenStichenInsStilleSoloUndOffenbartAlleParteien() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2),
                    karte(Farbe.KREUZ, Kartenwert.AS, 1),
                    karte(Farbe.PIK, Kartenwert.AS, 1)
                ),
                SpielerPosition.NORD, List.of(
                    karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
                    karte(Farbe.PIK, Kartenwert.KOENIG, 1),
                    karte(Farbe.KARO, Kartenwert.KOENIG, 1)
                ),
                SpielerPosition.OST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
                    karte(Farbe.PIK, Kartenwert.ZEHN, 1),
                    karte(Farbe.KARO, Kartenwert.ZEHN, 1)
                ),
                SpielerPosition.SUED, List.of(
                    karte(Farbe.KREUZ, Kartenwert.NEUN, 1),
                    karte(Farbe.PIK, Kartenwert.NEUN, 1),
                    karte(Farbe.KARO, Kartenwert.NEUN, 1)
                )
            )))
            .teileKartenAus()
            .meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();

        spiel = spieleStich(spiel,
            karte(Farbe.KREUZ, Kartenwert.AS, 1),
            karte(Farbe.KREUZ, Kartenwert.KOENIG, 1),
            karte(Farbe.KREUZ, Kartenwert.ZEHN, 1),
            karte(Farbe.KREUZ, Kartenwert.NEUN, 1));
        spiel = spieleStich(spiel,
            karte(Farbe.PIK, Kartenwert.AS, 1),
            karte(Farbe.PIK, Kartenwert.KOENIG, 1),
            karte(Farbe.PIK, Kartenwert.ZEHN, 1),
            karte(Farbe.PIK, Kartenwert.NEUN, 1));
        spiel = spieleStich(spiel,
            karte(Farbe.KREUZ, Kartenwert.DAME, 1),
            karte(Farbe.KARO, Kartenwert.KOENIG, 1),
            karte(Farbe.KARO, Kartenwert.ZEHN, 1),
            karte(Farbe.KARO, Kartenwert.NEUN, 1));

        HochzeitStatus status = spiel.hochzeitStatus().orElseThrow();
        assertTrue(status.stillesSolo(),
            "Wenn drei Klaerungsstiche lang kein Partner gefunden wird, muss die Hochzeit in ein stilles Solo kippen.");
        assertEquals(List.of(SpielerPosition.WEST), spiel.parteien().spielerVon(Partei.RE));
        for (SpielerPosition ziel : SpielerPosition.standardReihenfolge()) {
            assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.NORD, ziel).isPresent(),
                "Nach dem stillen Solo muessen alle Parteien offen sein, weil die Partnerfrage endgueltig geklaert ist.");
        }
    }

    @Test
    void lehntHochzeitOhneBeideKreuzDamenOderBeiDeaktivierterRegelAb() {
        Spiel spielMitNurEinerKreuzDame = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(karte(Farbe.KREUZ, Kartenwert.DAME, 1))
            )))
            .teileKartenAus();

        assertThrows(IllegalStateException.class,
            () -> spielMitNurEinerKreuzDame.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT),
            "Nur beide Kreuz-Damen rechtfertigen die Hochzeit; sonst wuerde ein normales Re/Kontra-Spiel faelschlich umetikettiert.");

        Spielregeln hochzeitDeaktiviert = spielregeln.mitHochzeitAktiv(false);
        Spiel deaktiviertesSpiel = Spiel.neu(SpielerPosition.SUED, hochzeitDeaktiviert, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2)
                )
            )))
            .teileKartenAus();

        assertThrows(IllegalStateException.class,
            () -> deaktiviertesSpiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT),
            "Die Tischkonfiguration muss Hochzeit serverseitig sperren koennen, damit Frontend und Backend dieselbe Regelbasis teilen.");
    }

    @Test
    void priorisiertTrumpfsoloVorHochzeit() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitVerteiltenHaenden(Map.of(
                SpielerPosition.WEST, List.of(
                    karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                    karte(Farbe.KREUZ, Kartenwert.DAME, 2)
                )
            )))
            .teileKartenAus()
            .meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.HOCHZEIT)
            .meldeVorbehalt(SpielerPosition.NORD, VorbehaltAnsage.SOLO_TRUMPF)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();

        assertEquals(Spieltyp.SOLO_TRUMPF, spiel.spieltyp(),
            "Soli muessen in der Vorbehaltsaufloesung ueber der Hochzeit liegen, sonst stimmt die Prioritaetsregel nicht.");
        assertEquals(List.of(SpielerPosition.NORD), spiel.parteien().spielerVon(Partei.RE));
    }

    @Test
    void lehntTrumpfsoloAbWennEsPerRegelnDeaktiviertIst() {
        Spielregeln soloDeaktiviert = spielregeln.mitSoloTrumpfAktiv(false);
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, soloDeaktiviert, kartendeckMitKontrolliertenHaenden())
            .teileKartenAus();

        assertThrows(IllegalStateException.class,
            () -> spiel.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.SOLO_TRUMPF),
            "Deaktivierte Sonderspiele muessen serverseitig geblockt werden, damit Tischkonfigurationen spaeter verbindlich bleiben.");
    }

    @Test
    void durchlaeuftEinNormalspielVonDerAusteilungBisZurAuswertung() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, Kartendeck.neu(spielregeln));

        assertEquals(Spielphase.KARTEN_AUSTEILEN, spiel.phase(),
            "Ein neues Spiel muss mit dem Austeilen beginnen, damit spaetere Schnittstellen die Phasen stabil orchestrieren koennen.");

        spiel = spiel.teileKartenAus();
        assertEquals(Spielphase.VORBEHALT_ANSAGE, spiel.phase());
        assertEquals(12, spiel.handVon(SpielerPosition.SUED).karten().size(),
            "Jeder Spieler braucht im Normalspiel 12 Karten, weil darauf die komplette Stichfolge basiert.");

        for (SpielerPosition position : SpielerPosition.imUhrzeigersinnAb(SpielerPosition.WEST)) {
            assertEquals(position, spiel.naechsterVorbehaltSpieler().orElseThrow(),
                "Die Vorbehaltsrunde muss links vom Geber starten und im Uhrzeigersinn laufen.");
            spiel = spiel.meldeGesund(position);
        }
        assertEquals(Spielphase.VORBEHALT_AUFLOESUNG, spiel.phase());

        spiel = spiel.loeseVorbehalteAuf();
        assertEquals(Spielphase.STICHPHASE, spiel.phase());
        assertEquals(Partei.RE, spiel.parteien().parteiVon(SpielerPosition.SUED));
        assertEquals(Partei.RE, spiel.parteien().parteiVon(SpielerPosition.WEST));
        assertEquals(Partei.KONTRA, spiel.parteien().parteiVon(SpielerPosition.NORD));
        assertEquals(Partei.KONTRA, spiel.parteien().parteiVon(SpielerPosition.OST));
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.SUED, SpielerPosition.SUED).isPresent(),
            "Jeder Spieler muss seine eigene Partei kennen, damit Ansagen spaeter regelkonform moeglich sind.");
        assertTrue(spiel.parteien().sichtAufPartei(SpielerPosition.SUED, SpielerPosition.WEST).isEmpty(),
            "Andere Parteien bleiben zu Beginn verdeckt, damit das Normalspiel fachlich korrekt startet.");

        while (spiel.phase() == Spielphase.STICHPHASE) {
            SpielerPosition aktuellerSpieler = spiel.aktuellerSpieler().orElseThrow();
            Karte karte = spiel.gueltigeKartenFuer(aktuellerSpieler).getFirst();
            spiel = spiel.spieleKarte(aktuellerSpieler, karte);
        }

        assertEquals(12, spiel.abgeschlosseneStiche().size(),
            "Ein vollstaendiges Normalspiel braucht 12 Stiche, sonst kann keine belastbare Endauswertung stattfinden.");
        assertEquals(Spielphase.AUSWERTUNG, spiel.phase());

        spiel = spiel.werteAus(punkteRechner);

        assertEquals(Spielphase.GESAMTSTAND_AKTUALISIEREN, spiel.phase());
        Spielergebnis ergebnis = spiel.ergebnis().orElseThrow();
        assertEquals(240, ergebnis.augenVon(Partei.RE) + ergebnis.augenVon(Partei.KONTRA));
        assertEquals(0, ergebnis.spielpunkteVon(SpielerPosition.SUED)
            + ergebnis.spielpunkteVon(SpielerPosition.WEST)
            + ergebnis.spielpunkteVon(SpielerPosition.NORD)
            + ergebnis.spielpunkteVon(SpielerPosition.OST),
            "Die Nullsumme macht den Partiestand robust und verhindert schleichende Bewertungsfehler.");
        assertFalse(spiel.aktuellerStich().isPresent());
    }

    @Test
    void lehntUngueltigeZustandsuebergaengeAb() {
        Spiel spiel = Spiel.neu(SpielerPosition.OST, spielregeln, Kartendeck.neu(spielregeln));
        Spiel neuesSpiel = spiel;

        assertThrows(IllegalStateException.class, () -> neuesSpiel.meldeGesund(SpielerPosition.SUED),
            "Ohne ausgeteilte Karten darf kein Spieler Vorbehalte melden, sonst verliert die Zustandsmaschine ihre Autoritaet.");

        spiel = spiel.teileKartenAus();
        Spiel spielMitAusgeteiltenKarten = spiel;
        assertThrows(IllegalStateException.class, spielMitAusgeteiltenKarten::loeseVorbehalteAuf,
            "Vorbehalte duerfen erst nach vier Meldungen aufgeloest werden, damit kein Spieler uebersprungen wird.");

        spiel = spiel.meldeGesund(SpielerPosition.SUED)
            .meldeGesund(SpielerPosition.WEST)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .loeseVorbehalteAuf();

        Spiel laufendesStichspiel = spiel;
        assertThrows(IllegalStateException.class, () -> laufendesStichspiel.werteAus(punkteRechner),
            "Eine Auswertung vor dem letzten Stich wuerde unvollstaendige Augenstaende in den Gesamtstand schleusen.");
    }

    @Test
    void laesstAnsagenNurFuerDenAktuellenSpielerUndNurImRegelkonformenFensterZu() {
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, spielregeln, kartendeckMitKontrolliertenHaenden())
            .teileKartenAus()
            .meldeGesund(SpielerPosition.WEST)
            .meldeGesund(SpielerPosition.NORD)
            .meldeGesund(SpielerPosition.OST)
            .meldeGesund(SpielerPosition.SUED)
            .loeseVorbehalteAuf();

        assertTrue(spiel.kannAnsagen(SpielerPosition.WEST, Ansage.RE),
            "Vor dem ersten Ausspiel muss der aktuelle Re-Spieler seine Partei ansagen koennen, sonst fehlen die Kernereignisse der Stichphase.");
        assertFalse(spiel.kannAnsagen(SpielerPosition.NORD, Ansage.KONTRA),
            "Nur der aktuelle Spieler darf ansagen, damit Reihenfolge und Zeitfenster an den echten Spielzug gekoppelt bleiben.");

        spiel = spiel.sageAn(SpielerPosition.WEST, Ansage.RE);
        assertTrue(spiel.ansagen().offenbartParteiVon(SpielerPosition.WEST),
            "Die Grundansage muss im Spielzustand festgehalten werden, damit UIs und Auswertung dieselbe Wahrheit sehen.");

        Spiel spielMitGespielterKarte = spiel.spieleKarte(SpielerPosition.WEST, spiel.gueltigeKartenFuer(SpielerPosition.WEST).getFirst());
        assertTrue(spielMitGespielterKarte.kannAnsagen(SpielerPosition.NORD, Ansage.KONTRA),
            "Nach dem Ausspiel muss der naechste aktuelle Spieler regelkonform eigene Ansagen taetigen koennen.");
    }

    private Spiel spieleStich(Spiel spiel, Karte ersteKarte, Karte zweiteKarte, Karte dritteKarte, Karte vierteKarte) {
        Spiel aktuellesSpiel = spiel;
        for (Karte karte : List.of(ersteKarte, zweiteKarte, dritteKarte, vierteKarte)) {
            SpielerPosition spieler = aktuellesSpiel.aktuellerSpieler().orElseThrow();
            aktuellesSpiel = aktuellesSpiel.spieleKarte(spieler, karte);
        }
        return aktuellesSpiel;
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
            while (haende.get(position).size() < 12) {
                haende.get(position).add(restkarten.removeFirst());
            }
        }

        List<Karte> deckkarten = new ArrayList<>();
        for (int index = 0; index < 12; index++) {
            for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
                deckkarten.add(haende.get(position).get(index));
            }
        }
        return kartendeckAus(deckkarten);
    }

    private Kartendeck kartendeckMitKontrolliertenHaenden() {
        List<Karte> karten = new ArrayList<>();
        for (int index = 1; index <= 12; index++) {
            karten.add(karteFuerSpieler(index, SpielerPosition.SUED));
            karten.add(karteFuerSpieler(index, SpielerPosition.WEST));
            karten.add(karteFuerSpieler(index, SpielerPosition.NORD));
            karten.add(karteFuerSpieler(index, SpielerPosition.OST));
        }
        return kartendeckAus(karten);
    }

    private Karte karteFuerSpieler(int index, SpielerPosition spielerPosition) {
        return switch (spielerPosition) {
            case SUED -> index == 1 ? new Karte(Farbe.KREUZ, Kartenwert.DAME, 1)
                : neueKontrollkarte(index, spielerPosition, 1);
            case WEST -> index == 1 ? new Karte(Farbe.KREUZ, Kartenwert.DAME, 2)
                : neueKontrollkarte(index, spielerPosition, 2);
            case NORD -> index == 1 ? new Karte(Farbe.HERZ, Kartenwert.AS, 1)
                : neueKontrollkarte(index, spielerPosition, 1);
            case OST -> index == 1 ? new Karte(Farbe.PIK, Kartenwert.AS, 1)
                : neueKontrollkarte(index, spielerPosition, 2);
        };
    }

    private Karte neueKontrollkarte(int index, SpielerPosition spielerPosition, int exemplarIndex) {
        Farbe[] farben = Farbe.values();
        Kartenwert[] werte = Kartenwert.values();
        Farbe farbe = farben[(index + spielerPosition.ordinal()) % farben.length];
        Kartenwert wert = werte[(index + spielerPosition.ordinal()) % werte.length];
        if (farbe == Farbe.KREUZ && wert == Kartenwert.DAME) {
            wert = Kartenwert.AS;
        }
        return new Karte(farbe, wert, exemplarIndex);
    }

    private Karte karte(Farbe farbe, Kartenwert wert, int exemplarIndex) {
        return new Karte(farbe, wert, exemplarIndex);
    }

    private Kartendeck kartendeckAus(List<Karte> karten) {
        try {
            java.lang.reflect.Constructor<Kartendeck> konstruktor = Kartendeck.class.getDeclaredConstructor(java.util.Collection.class);
            konstruktor.setAccessible(true);
            return konstruktor.newInstance(karten);
        } catch (ReflectiveOperationException ausnahme) {
            throw new IllegalStateException("Kontrolliertes Kartendeck konnte nicht erzeugt werden", ausnahme);
        }
    }
}
