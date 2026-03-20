package de.locodoko.spiel.partie;

import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Stich;
import de.locodoko.spiel.karten.TrumpfOrdnung;

import java.util.EnumMap;
import java.util.List;
import java.util.Objects;

public final class PunkteRechner {

    public Spielergebnis berechneNormalspielErgebnis(List<Stich> stiche, Parteien parteien, TrumpfOrdnung trumpfOrdnung) {
        Objects.requireNonNull(stiche, "stiche duerfen nicht null sein");
        Objects.requireNonNull(parteien, "parteien duerfen nicht null sein");
        Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        if (stiche.isEmpty()) {
            throw new IllegalArgumentException("Ein Spiel ohne Stiche kann nicht ausgewertet werden");
        }

        EnumMap<Partei, Integer> augenProPartei = new EnumMap<>(Partei.class);
        augenProPartei.put(Partei.RE, 0);
        augenProPartei.put(Partei.KONTRA, 0);
        for (Stich stich : stiche) {
            Partei partei = parteien.parteiVon(stich.gewinner(trumpfOrdnung).spieler());
            augenProPartei.merge(partei, stich.augen(), Integer::sum);
        }

        Partei siegerPartei = augenProPartei.get(Partei.RE) >= 121 ? Partei.RE : Partei.KONTRA;
        EnumMap<SpielerPosition, Integer> spielpunkteProSpieler = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            int spielpunkte = parteien.parteiVon(position) == siegerPartei ? 1 : -1;
            spielpunkteProSpieler.put(position, spielpunkte);
        }

        return new Spielergebnis(augenProPartei, siegerPartei, spielpunkteProSpieler);
    }
}
