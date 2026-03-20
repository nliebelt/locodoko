package de.locodoko.spiel.partie;

import de.locodoko.spiel.karten.Farbe;
import de.locodoko.spiel.karten.GespielteKarte;
import de.locodoko.spiel.karten.Kartenwert;
import de.locodoko.spiel.karten.Spielregeln;
import de.locodoko.spiel.karten.Stich;
import de.locodoko.spiel.karten.TrumpfOrdnung;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Objects;

public final class SonderpunktBewerter {

    public EnumMap<Partei, List<Sonderpunkt>> bewerte(
        List<Stich> stiche,
        Parteien parteien,
        TrumpfOrdnung trumpfOrdnung,
        Spielregeln spielregeln
    ) {
        Objects.requireNonNull(stiche, "stiche duerfen nicht null sein");
        Objects.requireNonNull(parteien, "parteien duerfen nicht null sein");
        Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");

        EnumMap<Partei, List<Sonderpunkt>> sonderpunkte = leereSonderpunktMap();
        for (int index = 0; index < stiche.size(); index++) {
            Stich stich = stiche.get(index);
            Partei gewinnerPartei = parteien.parteiVon(stich.gewinner(trumpfOrdnung).spieler());
            if (spielregeln.doppelkopfAktiv() && stich.augen() >= 40) {
                sonderpunkte.get(gewinnerPartei).add(Sonderpunkt.DOPPELKOPF);
            }
            if (spielregeln.fuchsAktiv()) {
                bewerteFuechse(stich, gewinnerPartei, parteien, sonderpunkte);
            }
            if (spielregeln.karlchenAktiv() && index == stiche.size() - 1) {
                GespielteKarte gewinnerkarte = stich.gewinner(trumpfOrdnung);
                if (istKarlchen(gewinnerkarte)) {
                    sonderpunkte.get(gewinnerPartei).add(Sonderpunkt.KARLCHEN);
                }
            }
        }
        return kopiereSonderpunkte(sonderpunkte);
    }

    private void bewerteFuechse(
        Stich stich,
        Partei gewinnerPartei,
        Parteien parteien,
        EnumMap<Partei, List<Sonderpunkt>> sonderpunkte
    ) {
        for (GespielteKarte gespielteKarte : stich.gespielteKarten()) {
            if (!istFuchs(gespielteKarte)) {
                continue;
            }
            Partei parteiDerKarte = parteien.parteiVon(gespielteKarte.spieler());
            if (parteiDerKarte != gewinnerPartei) {
                sonderpunkte.get(gewinnerPartei).add(Sonderpunkt.FUCHS_GEFANGEN);
            }
        }
    }

    private boolean istFuchs(GespielteKarte gespielteKarte) {
        return gespielteKarte.karte().farbe() == Farbe.KARO && gespielteKarte.karte().wert() == Kartenwert.AS;
    }

    private boolean istKarlchen(GespielteKarte gespielteKarte) {
        return gespielteKarte.karte().farbe() == Farbe.KREUZ && gespielteKarte.karte().wert() == Kartenwert.BUBE;
    }

    private EnumMap<Partei, List<Sonderpunkt>> leereSonderpunktMap() {
        EnumMap<Partei, List<Sonderpunkt>> sonderpunkte = new EnumMap<>(Partei.class);
        sonderpunkte.put(Partei.RE, new ArrayList<>());
        sonderpunkte.put(Partei.KONTRA, new ArrayList<>());
        return sonderpunkte;
    }

    private EnumMap<Partei, List<Sonderpunkt>> kopiereSonderpunkte(EnumMap<Partei, List<Sonderpunkt>> sonderpunkte) {
        EnumMap<Partei, List<Sonderpunkt>> kopie = new EnumMap<>(Partei.class);
        for (Partei partei : Partei.values()) {
            kopie.put(partei, List.copyOf(sonderpunkte.get(partei)));
        }
        return kopie;
    }
}
