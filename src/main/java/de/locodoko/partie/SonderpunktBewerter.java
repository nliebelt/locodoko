package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.TrumpfOrdnung;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Objects;

/**
 * Bewertet Sonderpunkte aus der abgeschlossenen Stichhistorie eines Spiels.
 *
 * <p>Ermittelt fuer jede Partei, welche {@link Sonderpunkt}-Ereignisse (Fuchs gefangen,
 * Karlchen, Doppelkopf) aufgetreten sind. Sonderpunkte erhoehen den Spielwert auf
 * Seiten der begueenstigten Partei. Ob ein Sonderpunkt aktiv ist, steuert
 * {@link de.locodoko.karten.Spielregeln}.</p>
 */
public final class SonderpunktBewerter {

    public EnumMap<Partei, List<SonderpunktEreignis>> bewerte(
        List<Stich> stiche,
        Parteien parteien,
        TrumpfOrdnung trumpfOrdnung,
        Spielregeln spielregeln
    ) {
        Objects.requireNonNull(stiche, "stiche duerfen nicht null sein");
        Objects.requireNonNull(parteien, "parteien duerfen nicht null sein");
        Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");

        EnumMap<Partei, List<SonderpunktEreignis>> sonderpunkte = leereSonderpunktMap();
        for (int index = 0; index < stiche.size(); index++) {
            Stich stich = stiche.get(index);
            GespielteKarte gewinnerKarte = stich.gewinner(trumpfOrdnung);
            SpielerPosition gewinnerPosition = gewinnerKarte.spieler();
            Partei gewinnerPartei = parteien.parteiVon(gewinnerPosition);
            if (spielregeln.doppelkopfAktiv() && stich.augen().mindestens(40)) {
                sonderpunkte.get(gewinnerPartei).add(new SonderpunktEreignis(Sonderpunkt.DOPPELKOPF, gewinnerPosition, null));
            }
            if (spielregeln.fuchsAktiv()) {
                bewerteFuechse(stich, gewinnerPosition, gewinnerPartei, parteien, sonderpunkte);
            }
            if (spielregeln.karlchenAktiv() && index == stiche.size() - 1) {
                if (istKarlchen(gewinnerKarte)) {
                    sonderpunkte.get(gewinnerPartei).add(new SonderpunktEreignis(Sonderpunkt.KARLCHEN, gewinnerPosition, null));
                }
            }
        }
        return kopiereSonderpunkte(sonderpunkte);
    }

    private void bewerteFuechse(
        Stich stich,
        SpielerPosition gewinnerPosition,
        Partei gewinnerPartei,
        Parteien parteien,
        EnumMap<Partei, List<SonderpunktEreignis>> sonderpunkte
    ) {
        for (GespielteKarte gespielteKarte : stich.gespielteKarten()) {
            if (!istFuchs(gespielteKarte)) {
                continue;
            }
            Partei parteiDerKarte = parteien.parteiVon(gespielteKarte.spieler());
            if (parteiDerKarte != gewinnerPartei) {
                sonderpunkte.get(gewinnerPartei).add(
                    new SonderpunktEreignis(Sonderpunkt.FUCHS_GEFANGEN, gewinnerPosition, gespielteKarte.spieler())
                );
            }
        }
    }

    private boolean istFuchs(GespielteKarte gespielteKarte) {
        return gespielteKarte.karte().farbe() == Farbe.KARO && gespielteKarte.karte().wert() == Kartenwert.AS;
    }

    private boolean istKarlchen(GespielteKarte gespielteKarte) {
        return gespielteKarte.karte().farbe() == Farbe.KREUZ && gespielteKarte.karte().wert() == Kartenwert.BUBE;
    }

    private EnumMap<Partei, List<SonderpunktEreignis>> leereSonderpunktMap() {
        EnumMap<Partei, List<SonderpunktEreignis>> sonderpunkte = new EnumMap<>(Partei.class);
        sonderpunkte.put(Partei.RE, new ArrayList<>());
        sonderpunkte.put(Partei.KONTRA, new ArrayList<>());
        return sonderpunkte;
    }

    private EnumMap<Partei, List<SonderpunktEreignis>> kopiereSonderpunkte(EnumMap<Partei, List<SonderpunktEreignis>> sonderpunkte) {
        EnumMap<Partei, List<SonderpunktEreignis>> kopie = new EnumMap<>(Partei.class);
        for (Partei partei : Partei.values()) {
            kopie.put(partei, List.copyOf(sonderpunkte.get(partei)));
        }
        return kopie;
    }
}
