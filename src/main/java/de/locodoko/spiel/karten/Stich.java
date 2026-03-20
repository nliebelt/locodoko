package de.locodoko.spiel.karten;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class Stich {

    private final SpielerPosition aufspieler;
    private final List<GespielteKarte> gespielteKarten;

    private Stich(SpielerPosition aufspieler, List<GespielteKarte> gespielteKarten) {
        this.aufspieler = Objects.requireNonNull(aufspieler, "aufspieler darf nicht null sein");
        this.gespielteKarten = List.copyOf(gespielteKarten);
        if (gespielteKarten.size() > 4) {
            throw new IllegalArgumentException("Ein Stich darf hoechstens vier Karten enthalten");
        }
    }

    public static Stich neu(SpielerPosition aufspieler) {
        return new Stich(aufspieler, List.of());
    }

    public SpielerPosition aufspieler() {
        return aufspieler;
    }

    public List<GespielteKarte> gespielteKarten() {
        return gespielteKarten;
    }

    public boolean istVollstaendig() {
        return gespielteKarten.size() == 4;
    }

    public SpielerPosition erwarteterSpieler() {
        return gespielteKarten.isEmpty() ? aufspieler : gespielteKarten.getLast().spieler().naechsteImUhrzeigersinn();
    }

    public Optional<Bedienfarbe> angefragteFarbe(TrumpfOrdnung trumpfOrdnung) {
        Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        return gespielteKarten.stream()
            .findFirst()
            .map(gespielteKarte -> trumpfOrdnung.bedienfarbeVon(gespielteKarte.karte()));
    }

    public List<Karte> gueltigeKarten(Hand hand, TrumpfOrdnung trumpfOrdnung) {
        Objects.requireNonNull(hand, "hand darf nicht null sein");
        Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        return angefragteFarbe(trumpfOrdnung)
            .map(bedienfarbe -> hand.gueltigeKarten(bedienfarbe, trumpfOrdnung))
            .orElseGet(hand::karten);
    }

    public Stich spieleKarte(SpielerPosition spieler, Karte karte, Hand hand, TrumpfOrdnung trumpfOrdnung) {
        Objects.requireNonNull(spieler, "spieler darf nicht null sein");
        Objects.requireNonNull(karte, "karte darf nicht null sein");
        Objects.requireNonNull(hand, "hand darf nicht null sein");
        Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        if (istVollstaendig()) {
            throw new UngueltigerSpielzugException("Der Stich ist bereits vollstaendig");
        }
        if (!hand.enthaelt(karte)) {
            throw new UngueltigerSpielzugException("Die gespielte Karte ist nicht auf der Hand");
        }
        SpielerPosition erwarteterSpieler = gespielteKarten.isEmpty()
            ? aufspieler
            : erwarteterSpieler();
        if (spieler != erwarteterSpieler) {
            throw new UngueltigerSpielzugException("Spieler " + spieler + " ist nicht an der Reihe; erwartet: " + erwarteterSpieler);
        }
        List<Karte> gueltigeKarten = gueltigeKarten(hand, trumpfOrdnung);
        if (!gueltigeKarten.contains(karte)) {
            throw new UngueltigerSpielzugException("Die Karte " + karte + " verletzt die Bedienpflicht");
        }
        List<GespielteKarte> neueKarten = new ArrayList<>(gespielteKarten);
        neueKarten.add(new GespielteKarte(spieler, karte, gespielteKarten.size()));
        return new Stich(aufspieler, neueKarten);
    }

    public GespielteKarte gewinner(TrumpfOrdnung trumpfOrdnung) {
        Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        if (gespielteKarten.isEmpty()) {
            throw new IllegalStateException("Ein leerer Stich hat keinen Gewinner");
        }
        Bedienfarbe angefragteFarbe = angefragteFarbe(trumpfOrdnung)
            .orElseThrow(() -> new IllegalStateException("Angefragte Farbe konnte nicht bestimmt werden"));
        GespielteKarte aktuelleGewinnerkarte = gespielteKarten.getFirst();
        for (int index = 1; index < gespielteKarten.size(); index++) {
            GespielteKarte kandidat = gespielteKarten.get(index);
            if (sticht(kandidat, aktuelleGewinnerkarte, angefragteFarbe, trumpfOrdnung)) {
                aktuelleGewinnerkarte = kandidat;
            }
        }
        return aktuelleGewinnerkarte;
    }

    public SpielerPosition naechsterAufspieler(TrumpfOrdnung trumpfOrdnung) {
        return gewinner(trumpfOrdnung).spieler();
    }

    public int augen() {
        return gespielteKarten.stream().mapToInt(gespielteKarte -> gespielteKarte.karte().augen()).sum();
    }

    private boolean sticht(
        GespielteKarte kandidat,
        GespielteKarte aktuelleGewinnerkarte,
        Bedienfarbe angefragteFarbe,
        TrumpfOrdnung trumpfOrdnung
    ) {
        boolean kandidatIstTrumpf = trumpfOrdnung.istTrumpf(kandidat.karte());
        boolean gewinnerIstTrumpf = trumpfOrdnung.istTrumpf(aktuelleGewinnerkarte.karte());
        if (kandidatIstTrumpf && !gewinnerIstTrumpf) {
            return true;
        }
        if (!kandidatIstTrumpf && gewinnerIstTrumpf) {
            return false;
        }
        if (kandidatIstTrumpf) {
            return istHoehererTrumpf(kandidat, aktuelleGewinnerkarte, trumpfOrdnung);
        }

        boolean kandidatBedient = angefragteFarbe.passtZu(kandidat.karte(), trumpfOrdnung);
        boolean gewinnerBedient = angefragteFarbe.passtZu(aktuelleGewinnerkarte.karte(), trumpfOrdnung);
        if (kandidatBedient && !gewinnerBedient) {
            return true;
        }
        if (!kandidatBedient) {
            return false;
        }
        int kandidatenRang = trumpfOrdnung.fehlRang(kandidat.karte());
        int gewinnerRang = trumpfOrdnung.fehlRang(aktuelleGewinnerkarte.karte());
        return kandidatenRang > gewinnerRang;
    }

    private boolean istHoehererTrumpf(GespielteKarte kandidat, GespielteKarte aktuelleGewinnerkarte, TrumpfOrdnung trumpfOrdnung) {
        int kandidatenRang = trumpfOrdnung.trumpfRang(kandidat.karte());
        int gewinnerRang = trumpfOrdnung.trumpfRang(aktuelleGewinnerkarte.karte());
        if (kandidatenRang > gewinnerRang) {
            return true;
        }
        if (kandidatenRang < gewinnerRang) {
            return false;
        }
        return kandidat.karte().gleicheAuspraegungWie(aktuelleGewinnerkarte.karte())
            && trumpfOrdnung.spaetereGleicheKarteGewinnt(kandidat.karte());
    }
}
