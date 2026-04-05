package de.locodoko.partie;

import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Stich;
import de.locodoko.karten.TrumpfOrdnung;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Berechnet das Spielergebnis nach Abschluss aller Stiche.
 *
 * <p>Zaehlt die Augen pro Partei, bestimmt die Sieger-Partei (ggf. unter Beruecksichtigung
 * von Ansagen/Absagen), leitet den Spielwert ab und verteilt Spielpunkte als Nullsumme
 * auf alle Spieler. Sonderpunkte werden ueber {@link SonderpunktBewerter} ermittelt und
 * in das Ergebnis eingerechnet.</p>
 */
public final class PunkteRechner {

    private final SonderpunktBewerter sonderpunktBewerter;

    public PunkteRechner() {
        this(new SonderpunktBewerter());
    }

    PunkteRechner(SonderpunktBewerter sonderpunktBewerter) {
        this.sonderpunktBewerter = Objects.requireNonNull(sonderpunktBewerter, "sonderpunktBewerter darf nicht null sein");
    }

    public Spielergebnis berechneNormalspielErgebnis(
        List<Stich> stiche,
        Parteien parteien,
        TrumpfOrdnung trumpfOrdnung,
        Ansagen ansagen,
        Spielregeln spielregeln
    ) {
        Objects.requireNonNull(stiche, "stiche duerfen nicht null sein");
        Objects.requireNonNull(parteien, "parteien duerfen nicht null sein");
        Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        Objects.requireNonNull(ansagen, "ansagen duerfen nicht null sein");
        Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
        if (stiche.isEmpty()) {
            throw new IllegalArgumentException("Ein Spiel ohne Stiche kann nicht ausgewertet werden");
        }

        EnumMap<Partei, Integer> augenProPartei = new EnumMap<>(Partei.class);
        augenProPartei.put(Partei.RE, 0);
        augenProPartei.put(Partei.KONTRA, 0);
        EnumMap<Partei, Integer> sticheProPartei = new EnumMap<>(Partei.class);
        sticheProPartei.put(Partei.RE, 0);
        sticheProPartei.put(Partei.KONTRA, 0);
        for (Stich stich : stiche) {
            Partei partei = parteien.parteiVon(stich.gewinner(trumpfOrdnung).spieler());
            augenProPartei.merge(partei, stich.augen(), Integer::sum);
            sticheProPartei.merge(partei, 1, Integer::sum);
        }

        Partei siegerPartei = augenProPartei.get(Partei.RE) >= 121 ? Partei.RE : Partei.KONTRA;
        EnumMap<Partei, List<Sonderpunkt>> sonderpunkteProPartei =
            sonderpunktBewerter.bewerte(stiche, parteien, trumpfOrdnung, spielregeln);

        int grundwert = grundwert(ansagen, parteien);
        int absagePunkte = bewerteAbsagen(siegerPartei, augenProPartei, sticheProPartei, parteien, ansagen);
        int gegenDieAltenPunkte = bewerteGegenDieAlten(siegerPartei, parteien, ansagen);
        int sonderpunkteWert = bewerteSonderpunkte(siegerPartei, sonderpunkteProPartei);
        int spielwert = Math.max(1, grundwert + absagePunkte + gegenDieAltenPunkte + sonderpunkteWert);

        List<SpielerPosition> sieger = parteien.spielerVon(siegerPartei);
        List<SpielerPosition> verlierer = parteien.spielerVon(siegerPartei.gegenpartei());
        int soloMultiplikator = (sieger.size() == 1 || verlierer.size() == 1) ? 3 : 1;

        EnumMap<SpielerPosition, Integer> spielpunkteProSpieler = new EnumMap<>(SpielerPosition.class);
        verteileSpielpunkte(spielpunkteProSpieler, parteien, siegerPartei, spielwert);
        return new Spielergebnis(
            augenProPartei, siegerPartei, spielwert,
            grundwert, absagePunkte, gegenDieAltenPunkte, soloMultiplikator,
            spielpunkteProSpieler, sonderpunkteProPartei
        );
    }

    private int grundwert(Ansagen ansagen, Parteien parteien) {
        int spielwert = 1;
        if (ansagen.hatGrundansage(Partei.RE, parteien)) {
            spielwert *= 2;
        }
        if (ansagen.hatGrundansage(Partei.KONTRA, parteien)) {
            spielwert *= 2;
        }
        return spielwert;
    }

    private int bewerteAbsagen(
        Partei siegerPartei,
        Map<Partei, Integer> augenProPartei,
        Map<Partei, Integer> sticheProPartei,
        Parteien parteien,
        Ansagen ansagen
    ) {
        int spielwert = 0;
        for (Partei partei : Partei.values()) {
            for (Ansage ansage : List.of(Ansage.KEINE_90, Ansage.KEINE_60, Ansage.KEINE_30, Ansage.SCHWARZ)) {
                if (!ansagen.hatParteiAnsage(partei, ansage, parteien)) {
                    continue;
                }
                boolean erreicht = ansageErreicht(partei, ansage, augenProPartei, sticheProPartei);
                boolean parteiIstSieger = partei == siegerPartei;
                spielwert += erreicht == parteiIstSieger ? 1 : -1;
            }
        }
        return spielwert;
    }

    private boolean ansageErreicht(
        Partei partei,
        Ansage ansage,
        Map<Partei, Integer> augenProPartei,
        Map<Partei, Integer> sticheProPartei
    ) {
        Partei gegenpartei = partei.gegenpartei();
        return switch (ansage) {
            case KEINE_90 -> augenProPartei.get(gegenpartei) < 90;
            case KEINE_60 -> augenProPartei.get(gegenpartei) < 60;
            case KEINE_30 -> augenProPartei.get(gegenpartei) < 30;
            case SCHWARZ -> sticheProPartei.get(gegenpartei) == 0;
            case RE, KONTRA -> throw new IllegalArgumentException("Grundansagen koennen nicht als Absagen bewertet werden");
        };
    }

    private int bewerteGegenDieAlten(Partei siegerPartei, Parteien parteien, Ansagen ansagen) {
        return siegerPartei == Partei.KONTRA && ansagen.hatGrundansage(Partei.RE, parteien) ? 1 : 0;
    }

    private int bewerteSonderpunkte(Partei siegerPartei, Map<Partei, List<Sonderpunkt>> sonderpunkteProPartei) {
        int spielwert = 0;
        for (Partei partei : Partei.values()) {
            int anzahl = sonderpunkteProPartei.get(partei).size();
            spielwert += partei == siegerPartei ? anzahl : -anzahl;
        }
        return spielwert;
    }

    private void verteileSpielpunkte(
        EnumMap<SpielerPosition, Integer> spielpunkteProSpieler,
        Parteien parteien,
        Partei siegerPartei,
        int spielwert
    ) {
        List<SpielerPosition> sieger = parteien.spielerVon(siegerPartei);
        List<SpielerPosition> verlierer = parteien.spielerVon(siegerPartei.gegenpartei());
        int siegerWert = spielwert;
        int verliererWert = -spielwert;
        if (sieger.size() == 1 && verlierer.size() == 3) {
            siegerWert = spielwert * 3;
        } else if (sieger.size() == 3 && verlierer.size() == 1) {
            verliererWert = -spielwert * 3;
        }
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            spielpunkteProSpieler.put(position, parteien.parteiVon(position) == siegerPartei ? siegerWert : verliererWert);
        }
    }
}
