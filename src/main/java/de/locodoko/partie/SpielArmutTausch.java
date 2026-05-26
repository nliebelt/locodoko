package de.locodoko.partie;

import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.TrumpfOrdnung;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Verarbeitet die drei Armut-Tausch-Aktionen: Anbieten, Ablehnen und Annehmen. */
class SpielArmutTausch {

    static void legeArmutTrumpfkarten(Spiel spiel, SpielerPosition spielerPosition,
            List<Karte> angeboteneTrumpfkarten, ArmutStatus status,
            Hand armutHand, TrumpfOrdnung trumpfOrdnung, Map<SpielerPosition, Hand> haende) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(angeboteneTrumpfkarten, "angeboteneTrumpfkarten duerfen nicht null sein");
        if (spielerPosition != status.armutSpieler()) { throw new IllegalStateException("Nur der Armut-Spieler darf Trumpfkarten anbieten"); }
        if (status.angebotLiegtVor()) { throw new IllegalStateException("Die Trumpfkarten fuer die Armut wurden bereits angeboten"); }
        long anzahlTruepfe = armutHand.karten().stream().filter(trumpfOrdnung::istTrumpf).count();
        if (angeboteneTrumpfkarten.size() != anzahlTruepfe) { throw new IllegalStateException("Die Armut muss genau alle eigenen Trumpfkarten anbieten; erwartet: " + anzahlTruepfe); }
        for (Karte karte : angeboteneTrumpfkarten) {
            if (!armutHand.enthaelt(karte)) { throw new IllegalStateException("Angebotene Karte ist nicht auf der Hand des Armut-Spielers: " + karte); }
            if (!trumpfOrdnung.istTrumpf(karte)) { throw new IllegalStateException("In der Armut duerfen nur Trumpfkarten angeboten werden: " + karte); }
        }
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende(haende);
        neueHaende.put(spielerPosition, armutHand.ohneAlle(angeboteneTrumpfkarten));
        spiel.haende = neueHaende;
        spiel.phase = new Spielphase.ArmutTausch(status.mitAngebot(angeboteneTrumpfkarten));
    }

    static void lehneArmutAb(Spiel spiel, SpielerPosition spielerPosition,
            ArmutStatus status, Spielregeln spielregeln, SpielerPosition geber,
            int einwurfZaehler, de.locodoko.karten.Kartendeck kartendeck) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        if (!status.angebotLiegtVor()) { throw new IllegalStateException("Die Armut kann erst nach dem Trumpf-Angebot abgelehnt werden"); }
        ArmutStatus neuerStatus = status.mitAblehnung(spielerPosition);
        if (neuerStatus.alleAntwortenErschoepft()) {
            SpielVorbehaltAufloesung.eingeworfenesSpiel(spiel, kartendeck, spielregeln, geber, einwurfZaehler);
            return;
        }
        spiel.phase = new Spielphase.ArmutTausch(neuerStatus);
    }

    static void nimmArmutAn(Spiel spiel, SpielerPosition spielerPosition,
            List<Karte> rueckgabekarten, ArmutStatus status, SpielerPosition solistAufspieler,
            SpielerPosition geber, Map<SpielerPosition, Hand> haende, Spielregeln spielregeln,
            TrumpfOrdnung aktuelleOrdnung, Parteien aktuelleParteien) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(rueckgabekarten, "rueckgabekarten duerfen nicht null sein");
        if (!status.angebotLiegtVor()) { throw new IllegalStateException("Die Armut kann erst nach dem Trumpf-Angebot angenommen werden"); }
        SpielerPosition erwarteterSpieler = status.aktuellerAntwortspieler()
            .orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen moeglichen Armut-Partner"));
        if (spielerPosition != erwarteterSpieler) { throw new IllegalStateException("Die Armut muss reihum beantwortet werden; erwartet: " + erwarteterSpieler); }
        if (rueckgabekarten.size() != status.angeboteneTrumpfkarten().size()) {
            throw new IllegalStateException("Es muessen genau " + status.angeboteneTrumpfkarten().size() + " Karten zurueckgegeben werden");
        }
        Hand partnerHand = haende.get(spielerPosition);
        if (partnerHand == null) { throw new IllegalArgumentException("Es gibt keine Hand fuer " + spielerPosition); }
        for (Karte karte : rueckgabekarten) {
            if (!partnerHand.enthaelt(karte)) { throw new IllegalStateException("Zurueckgegebene Karte ist nicht auf der Hand des annehmenden Spielers: " + karte); }
        }
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende(haende);
        neueHaende.put(spielerPosition, partnerHand.ohneAlle(rueckgabekarten).mitAllen(status.angeboteneTrumpfkarten()));
        neueHaende.put(status.armutSpieler(), haende.get(status.armutSpieler()).mitAllen(rueckgabekarten));
        Parteien neueParteien = aktuelleParteien.mitPartei(spielerPosition, Partei.RE)
            .mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge());
        SpielerPosition ersterAufspieler = solistAufspieler != null ? solistAufspieler : geber.naechsteImUhrzeigersinn();
        spiel.trumpfOrdnung = new NormaleTrumpfOrdnung(spielregeln);
        spiel.phase = new Spielphase.Stichphase(Stich.neu(ersterAufspieler), java.util.Set.of(), null);
        spiel.haende = neueHaende;
        spiel.parteien = neueParteien;
        spiel.ansagen = Ansagen.leer();
        spiel.abgeschlosseneStiche = List.of();
        spiel.ergebnis = null;
        spiel.solistAufspieler = null;
    }

    private static Map<SpielerPosition, Hand> kopiereHaende(Map<SpielerPosition, Hand> haende) {
        EnumMap<SpielerPosition, Hand> k = new EnumMap<>(SpielerPosition.class);
        k.putAll(haende);
        return k;
    }
}
