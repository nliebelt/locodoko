package de.locodoko.spiel.partie;

import de.locodoko.spiel.karten.Hand;
import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.Kartendeck;
import de.locodoko.spiel.karten.NormaleTrumpfOrdnung;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spielregeln;
import de.locodoko.spiel.karten.Spieltyp;
import de.locodoko.spiel.karten.Stich;
import de.locodoko.spiel.karten.TrumpfOrdnung;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

public final class Spiel {

    private final Spielregeln spielregeln;
    private final Kartendeck kartendeck;
    private final TrumpfOrdnung trumpfOrdnung;
    private final Spieltyp spieltyp;
    private final SpielerPosition geber;
    private final Spielphase phase;
    private final Map<SpielerPosition, Hand> haende;
    private final List<SpielerPosition> gesundGemeldet;
    private final Parteien parteien;
    private final Ansagen ansagen;
    private final List<Stich> abgeschlosseneStiche;
    private final Stich aktuellerStich;
    private final Spielergebnis ergebnis;

    private Spiel(
        Spielregeln spielregeln,
        Kartendeck kartendeck,
        TrumpfOrdnung trumpfOrdnung,
        Spieltyp spieltyp,
        SpielerPosition geber,
        Spielphase phase,
        Map<SpielerPosition, Hand> haende,
        List<SpielerPosition> gesundGemeldet,
        Parteien parteien,
        Ansagen ansagen,
        List<Stich> abgeschlosseneStiche,
        Stich aktuellerStich,
        Spielergebnis ergebnis
    ) {
        this.spielregeln = Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
        this.kartendeck = Objects.requireNonNull(kartendeck, "kartendeck darf nicht null sein");
        this.trumpfOrdnung = Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        this.spieltyp = Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein");
        this.geber = Objects.requireNonNull(geber, "geber darf nicht null sein");
        this.phase = Objects.requireNonNull(phase, "phase darf nicht null sein");
        this.haende = Map.copyOf(haende);
        this.gesundGemeldet = List.copyOf(gesundGemeldet);
        this.parteien = parteien;
        this.ansagen = Objects.requireNonNull(ansagen, "ansagen duerfen nicht null sein");
        this.abgeschlosseneStiche = List.copyOf(abgeschlosseneStiche);
        this.aktuellerStich = aktuellerStich;
        this.ergebnis = ergebnis;
    }

    public static Spiel neu(SpielerPosition geber, Spielregeln spielregeln, Kartendeck kartendeck) {
        Objects.requireNonNull(geber, "geber darf nicht null sein");
        return new Spiel(
            spielregeln,
            kartendeck,
            new NormaleTrumpfOrdnung(spielregeln),
            Spieltyp.NORMALSPIEL,
            geber,
            Spielphase.KARTEN_AUSTEILEN,
            Map.of(),
            List.of(),
            null,
            Ansagen.leer(),
            List.of(),
            null,
            null
        );
    }

    public Spiel teileKartenAus() {
        pruefePhase(Spielphase.KARTEN_AUSTEILEN, "Karten austeilen");
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            Spielphase.VORBEHALT_ANSAGE,
            kartendeck.anVierSpielerAusteilen(),
            gesundGemeldet,
            null,
            ansagen,
            abgeschlosseneStiche,
            null,
            null
        );
    }

    public Optional<SpielerPosition> naechsterVorbehaltSpieler() {
        if (phase != Spielphase.VORBEHALT_ANSAGE || gesundGemeldet.size() >= SpielerPosition.standardReihenfolge().size()) {
            return Optional.empty();
        }
        List<SpielerPosition> reihenfolge = SpielerPosition.imUhrzeigersinnAb(geber.naechsteImUhrzeigersinn());
        return Optional.of(reihenfolge.get(gesundGemeldet.size()));
    }

    public Spiel meldeGesund(SpielerPosition spielerPosition) {
        pruefePhase(Spielphase.VORBEHALT_ANSAGE, "Gesund melden");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        SpielerPosition erwarteterSpieler = naechsterVorbehaltSpieler()
            .orElseThrow(() -> new IllegalStateException("Es werden keine Vorbehalte mehr erwartet"));
        if (spielerPosition != erwarteterSpieler) {
            throw new IllegalStateException("Vorbehalte muessen in Sitzreihenfolge gemeldet werden; erwartet: " + erwarteterSpieler);
        }
        List<SpielerPosition> neueGesundMeldungen = new ArrayList<>(gesundGemeldet);
        neueGesundMeldungen.add(spielerPosition);
        Spielphase naechstePhase = neueGesundMeldungen.size() == SpielerPosition.standardReihenfolge().size()
            ? Spielphase.VORBEHALT_AUFLOESUNG
            : Spielphase.VORBEHALT_ANSAGE;
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            naechstePhase,
            haende,
            neueGesundMeldungen,
            parteien,
            ansagen,
            abgeschlosseneStiche,
            aktuellerStich,
            ergebnis
        );
    }

    public Spiel loeseVorbehalteAuf() {
        pruefePhase(Spielphase.VORBEHALT_AUFLOESUNG, "Vorbehalte aufloesen");
        Parteien neueParteien = Parteien.ausNormalspielHaenden(haende);
        Stich ersterStich = Stich.neu(geber.naechsteImUhrzeigersinn());
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            Spieltyp.NORMALSPIEL,
            geber,
            Spielphase.STICHPHASE,
            haende,
            gesundGemeldet,
            neueParteien,
            Ansagen.leer(),
            List.of(),
            ersterStich,
            null
        );
    }

    public Optional<SpielerPosition> aktuellerSpieler() {
        if (phase != Spielphase.STICHPHASE || aktuellerStich == null) {
            return Optional.empty();
        }
        return Optional.of(aktuellerStich.erwarteterSpieler());
    }

    public List<Karte> gueltigeKartenFuer(SpielerPosition spielerPosition) {
        pruefePhase(Spielphase.STICHPHASE, "gueltige Karten abfragen");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        SpielerPosition erwarteterSpieler = aktuellerSpieler()
            .orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen erwarteten Spieler"));
        if (spielerPosition != erwarteterSpieler) {
            throw new IllegalStateException("Gueltige Karten koennen nur fuer den aktuellen Spieler abgefragt werden; erwartet: " + erwarteterSpieler);
        }
        return aktuellerStich.gueltigeKarten(handVon(spielerPosition), trumpfOrdnung);
    }

    public Spiel spieleKarte(SpielerPosition spielerPosition, Karte karte) {
        pruefePhase(Spielphase.STICHPHASE, "Karte spielen");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(karte, "karte darf nicht null sein");

        Hand hand = handVon(spielerPosition);
        Stich gespielterStich = aktuellerStich.spieleKarte(spielerPosition, karte, hand, trumpfOrdnung);
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende();
        neueHaende.put(spielerPosition, hand.ohne(karte));

        if (!gespielterStich.istVollstaendig()) {
            return new Spiel(
                spielregeln,
                kartendeck,
                trumpfOrdnung,
                spieltyp,
                geber,
                phase,
                neueHaende,
                gesundGemeldet,
                parteien,
                ansagen,
                abgeschlosseneStiche,
                gespielterStich,
                ergebnis
            );
        }

        List<Stich> neueAbgeschlosseneStiche = new ArrayList<>(abgeschlosseneStiche);
        neueAbgeschlosseneStiche.add(gespielterStich);
        if (neueAbgeschlosseneStiche.size() == kartenProSpieler()) {
            return new Spiel(
                spielregeln,
                kartendeck,
                trumpfOrdnung,
                spieltyp,
                geber,
                Spielphase.AUSWERTUNG,
                neueHaende,
                gesundGemeldet,
                parteien,
                ansagen,
                neueAbgeschlosseneStiche,
                null,
                ergebnis
            );
        }

        Stich naechsterStich = Stich.neu(gespielterStich.naechsterAufspieler(trumpfOrdnung));
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            Spielphase.STICHPHASE,
            neueHaende,
            gesundGemeldet,
            parteien,
            ansagen,
            neueAbgeschlosseneStiche,
            naechsterStich,
            ergebnis
        );
    }

    public boolean kannAnsagen(SpielerPosition spielerPosition, Ansage ansage) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        if (phase != Spielphase.STICHPHASE || aktuellerStich == null || spielerPosition != aktuellerStich.erwarteterSpieler()) {
            return false;
        }
        return ansagen.kannAnsagen(spielerPosition, ansage, parteien(), spielregeln, handVon(spielerPosition).karten().size());
    }

    public Spiel sageAn(SpielerPosition spielerPosition, Ansage ansage) {
        pruefePhase(Spielphase.STICHPHASE, "Ansage taetigen");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        SpielerPosition erwarteterSpieler = aktuellerSpieler()
            .orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen erwarteten Spieler"));
        if (spielerPosition != erwarteterSpieler) {
            throw new IllegalStateException("Ansagen duerfen nur vom aktuellen Spieler kommen; erwartet: " + erwarteterSpieler);
        }
        Ansagen neueAnsagen = ansagen.fuegeHinzu(
            spielerPosition,
            ansage,
            parteien(),
            spielregeln,
            handVon(spielerPosition).karten().size()
        );
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            phase,
            haende,
            gesundGemeldet,
            parteien,
            neueAnsagen,
            abgeschlosseneStiche,
            aktuellerStich,
            ergebnis
        );
    }

    public Spiel werteAus(PunkteRechner punkteRechner) {
        pruefePhase(Spielphase.AUSWERTUNG, "Spiel auswerten");
        Objects.requireNonNull(punkteRechner, "punkteRechner darf nicht null sein");
        Spielergebnis neuesErgebnis = punkteRechner.berechneNormalspielErgebnis(
            abgeschlosseneStiche,
            parteien(),
            trumpfOrdnung,
            ansagen,
            spielregeln
        );
        return new Spiel(
            spielregeln,
            kartendeck,
            trumpfOrdnung,
            spieltyp,
            geber,
            Spielphase.GESAMTSTAND_AKTUALISIEREN,
            haende,
            gesundGemeldet,
            parteien,
            ansagen,
            abgeschlosseneStiche,
            null,
            neuesErgebnis
        );
    }

    public Spielregeln spielregeln() {
        return spielregeln;
    }

    public Spieltyp spieltyp() {
        return spieltyp;
    }

    public SpielerPosition geber() {
        return geber;
    }

    public Spielphase phase() {
        return phase;
    }

    public Map<SpielerPosition, Hand> haende() {
        return haende;
    }

    public Hand handVon(SpielerPosition spielerPosition) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Hand hand = haende.get(spielerPosition);
        if (hand == null) {
            throw new IllegalArgumentException("Es gibt keine Hand fuer " + spielerPosition);
        }
        return hand;
    }

    public List<Stich> abgeschlosseneStiche() {
        return abgeschlosseneStiche;
    }

    public Optional<Stich> aktuellerStich() {
        return Optional.ofNullable(aktuellerStich);
    }

    public Parteien parteien() {
        if (parteien == null) {
            throw new IllegalStateException("Die Parteien sind erst nach der Vorbehaltsaufloesung bekannt");
        }
        return parteien;
    }

    public Ansagen ansagen() {
        return ansagen;
    }

    public Optional<Spielergebnis> ergebnis() {
        return Optional.ofNullable(ergebnis);
    }

    private Map<SpielerPosition, Hand> kopiereHaende() {
        EnumMap<SpielerPosition, Hand> kopie = new EnumMap<>(SpielerPosition.class);
        kopie.putAll(haende);
        return kopie;
    }

    private int kartenProSpieler() {
        return kartendeck.karten().size() / SpielerPosition.standardReihenfolge().size();
    }

    private void pruefePhase(Spielphase erwartetePhase, String aktion) {
        if (phase != erwartetePhase) {
            throw new IllegalStateException(aktion + " ist nur in Phase " + erwartetePhase + " erlaubt, war aber " + phase);
        }
    }
}
