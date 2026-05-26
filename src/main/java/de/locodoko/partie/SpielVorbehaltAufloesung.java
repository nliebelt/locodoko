package de.locodoko.partie;

import de.locodoko.karten.BubensoloTrumpfOrdnung;
import de.locodoko.karten.DamensoloTrumpfOrdnung;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.FleischlosTrumpfOrdnung;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.SchweinchenTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.karten.TrumpfOrdnung;
import de.locodoko.karten.VariableTrumpfsoloTrumpfOrdnung;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Berechnet das Ergebnis der Vorbehalt-Auflösung und erzeugt eingeworfene Spiele. */
class SpielVorbehaltAufloesung {

    static void aufloesen(Spiel spiel, List<VorbehaltMeldung> vorbehalte,
            TrumpfOrdnung aktuelleOrdnung, Spielregeln spielregeln,
            Map<SpielerPosition, Hand> haende, SpielerPosition geber,
            SpielerPosition solistAufspieler, Kartendeck kartendeck, int einwurfZaehler) {
        VorbehaltMeldung hoechsterVorbehalt = SpielHydrierer.hoechsterVorbehaltAusListe(vorbehalte).orElse(null);
        if (hoechsterVorbehalt != null && hoechsterVorbehalt.ansage().istSchmeissen()) {
            eingeworfenesSpiel(spiel, kartendeck, spielregeln, geber, einwurfZaehler);
            return;
        }
        SpielerPosition ersterAufspieler = solistAufspieler != null ? solistAufspieler : geber.naechsteImUhrzeigersinn();
        if (hoechsterVorbehalt == null) {
            SpielerPosition stillesSoloSpieler = erkenneStillesSoloSpieler(haende);
            if (stillesSoloSpieler != null) {
                boolean schweinchen = hatSchweinchen(spielregeln, haende);
                spiel.spieltyp = Spieltyp.SOLO_TRUMPF;
                spiel.setzeTrumpfOrdnung(schweinchen ? new SchweinchenTrumpfOrdnung(spielregeln) : new NormaleTrumpfOrdnung(spielregeln));
                spiel.setzePhase(new Spielphase.Stichphase(Stich.neu(ersterAufspieler), java.util.Set.of(), null));
                spiel.parteien = Parteien.ausSolo(stillesSoloSpieler);
                spiel.ansagen = Ansagen.leer();
                spiel.abgeschlosseneStiche = List.of();
                spiel.ergebnis = null;
                spiel.solistAufspieler = null;
                return;
            }
        }
        Parteien neueParteien = hoechsterVorbehalt == null ? Parteien.ausNormalspielHaenden(haende) : parteienFuer(hoechsterVorbehalt);
        HochzeitStatus neuerHochzeitStatus = hoechsterVorbehalt != null && hoechsterVorbehalt.ansage() == VorbehaltAnsage.HOCHZEIT
            ? HochzeitStatus.gestartet(hoechsterVorbehalt.spielerPosition()) : null;
        ArmutStatus neuerArmutStatus = hoechsterVorbehalt != null && hoechsterVorbehalt.ansage() == VorbehaltAnsage.ARMUT
            ? ArmutStatus.gestartet(hoechsterVorbehalt.spielerPosition()) : null;
        Spielphase naechstePhase = neuerArmutStatus != null
            ? new Spielphase.ArmutTausch(neuerArmutStatus)
            : new Spielphase.Stichphase(Stich.neu(ersterAufspieler), java.util.Set.of(), neuerHochzeitStatus);
        spiel.spieltyp = spieltypFuer(hoechsterVorbehalt);
        spiel.setzeTrumpfOrdnung(trumpfOrdnungFuer(hoechsterVorbehalt, aktuelleOrdnung, spielregeln, haende));
        spiel.setzePhase(naechstePhase);
        spiel.parteien = neueParteien;
        spiel.ansagen = Ansagen.leer();
        spiel.abgeschlosseneStiche = List.of();
        spiel.ergebnis = null;
        spiel.solistAufspieler = null;
    }

    static void eingeworfenesSpiel(Spiel spiel, Kartendeck aktuellesKartendeck,
            Spielregeln spielregeln, SpielerPosition geber, int einwurfZaehler) {
        Kartendeck nd = aktuellesKartendeck.gemischt();
        spiel.kartendeck = nd;
        spiel.spieltyp = Spieltyp.NORMALSPIEL;
        spiel.setzeTrumpfOrdnung(new NormaleTrumpfOrdnung(spielregeln));
        spiel.setzePhase(Spielphase.VORBEHALT_ANSAGE);
        spiel.haende = haendeAusDeck(nd);
        spiel.vorbehalte = List.of();
        spiel.parteien = null;
        spiel.ansagen = Ansagen.leer();
        spiel.abgeschlosseneStiche = List.of();
        spiel.ergebnis = null;
        spiel.solistAufspieler = null;
        spiel.einwurfZaehler = einwurfZaehler + 1;
    }

    static TrumpfOrdnung trumpfOrdnungFuerPersistiertenStand(Spielregeln sr, Spieltyp st, boolean sa) {
        return switch (Objects.requireNonNull(st)) {
            case NORMALSPIEL, SOLO_TRUMPF -> sa ? new SchweinchenTrumpfOrdnung(sr) : new NormaleTrumpfOrdnung(sr);
            case HOCHZEIT, ARMUT -> new NormaleTrumpfOrdnung(sr);
            case SOLO_TRUMPF_HERZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.HERZ, sr);
            case SOLO_TRUMPF_PIK -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.PIK, sr);
            case SOLO_TRUMPF_KREUZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.KREUZ, sr);
            case SOLO_DAME -> new DamensoloTrumpfOrdnung();
            case SOLO_BUBE -> new BubensoloTrumpfOrdnung();
            case SOLO_FLEISCHLOS -> new FleischlosTrumpfOrdnung();
        };
    }

    private static Spieltyp spieltypFuer(VorbehaltMeldung hv) {
        return hv == null ? Spieltyp.NORMALSPIEL
            : hv.ansage().spieltyp().orElseThrow(() -> new IllegalStateException("Vorbehalt ohne Spieltyp kann nicht aufgeloest werden"));
    }

    private static TrumpfOrdnung trumpfOrdnungFuer(VorbehaltMeldung hv, TrumpfOrdnung aktuelle, Spielregeln sr, Map<SpielerPosition, Hand> haende) {
        return hv == null ? aktuelle : switch (hv.ansage()) {
            case SOLO_DAME -> new DamensoloTrumpfOrdnung();
            case SOLO_BUBE -> new BubensoloTrumpfOrdnung();
            case SOLO_TRUMPF -> hatSchweinchen(sr, haende) ? new SchweinchenTrumpfOrdnung(sr) : new NormaleTrumpfOrdnung(sr);
            case HOCHZEIT, ARMUT -> new NormaleTrumpfOrdnung(sr);
            case SOLO_TRUMPF_HERZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.HERZ, sr);
            case SOLO_TRUMPF_PIK -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.PIK, sr);
            case SOLO_TRUMPF_KREUZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.KREUZ, sr);
            case SOLO_FLEISCHLOS -> new FleischlosTrumpfOrdnung();
            case GESUND, SCHMEISSEN, SCHMEISSEN_FUENF_NEUNEN, SCHMEISSEN_WENIG_TRUMPF ->
                throw new IllegalStateException("GESUND ist kein aufloesbarer Vorbehalt");
        };
    }

    private static Parteien parteienFuer(VorbehaltMeldung hv) {
        return switch (hv.ansage()) {
            case SOLO_DAME, SOLO_BUBE, SOLO_TRUMPF, SOLO_TRUMPF_HERZ, SOLO_TRUMPF_PIK, SOLO_TRUMPF_KREUZ, SOLO_FLEISCHLOS ->
                Parteien.ausSolo(hv.spielerPosition());
            case HOCHZEIT -> Parteien.ausHochzeit(hv.spielerPosition());
            case ARMUT -> Parteien.ausArmut(hv.spielerPosition());
            case GESUND, SCHMEISSEN, SCHMEISSEN_FUENF_NEUNEN, SCHMEISSEN_WENIG_TRUMPF ->
                throw new IllegalStateException("GESUND ist kein aufloesbarer Vorbehalt");
        };
    }

    private static SpielerPosition erkenneStillesSoloSpieler(Map<SpielerPosition, Hand> haende) {
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
            Hand h = haende.get(pos);
            if (h != null && h.karten().stream()
                .filter(k -> k.farbe() == Farbe.KREUZ && k.wert() == Kartenwert.DAME).count() >= 2) return pos;
        }
        return null;
    }

    static Map<SpielerPosition, Hand> haendeAusDeck(Kartendeck deck) {
        List<Hand> l = deck.anVierSpielerAusteilen();
        List<SpielerPosition> p = SpielerPosition.standardReihenfolge();
        EnumMap<SpielerPosition, Hand> m = new EnumMap<>(SpielerPosition.class);
        for (int i = 0; i < p.size(); i++) m.put(p.get(i), l.get(i));
        return Map.copyOf(m);
    }

    static boolean hatSchweinchen(Spielregeln sr, Map<SpielerPosition, Hand> h) {
        return sr.schweinchenAktiv() && h.values().stream().anyMatch(hand ->
            hand.karten().stream().filter(k -> k.farbe() == Farbe.KARO && k.wert() == Kartenwert.AS).count() == 2);
    }
}
