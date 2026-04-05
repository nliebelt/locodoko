package de.locodoko.partie;

import de.locodoko.karten.SpielerPosition;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Unveraenderliches Ergebnis eines abgeschlossenen Doppelkopf-Spiels.
 *
 * <p>Enthaelt Augen pro Partei (Summe immer 240), die Sieger-Partei, den Spielwert
 * sowie dessen Aufschluesselung (Grundwert, Absage-Punkte, Gegen-die-Alten, Solo-Multiplikator),
 * die als Nullsumme verteilten Spielpunkte je Spieler sowie aufgetretene Sonderpunkte
 * pro Partei (Fuchs, Karlchen, Doppelkopf). Wird von {@link PunkteRechner} erzeugt
 * und direkt in den Partie-Snapshot uebernommen.</p>
 */
public record Spielergebnis(
    Map<Partei, Integer> augenProPartei,
    Partei siegerPartei,
    int spielwert,
    int grundwert,
    int absagePunkte,
    int gegenDieAltenPunkte,
    int soloMultiplikator,
    Map<SpielerPosition, Integer> spielpunkteProSpieler,
    Map<Partei, List<SonderpunktEreignis>> sonderpunkteProPartei
) {

    public Spielergebnis {
        Objects.requireNonNull(augenProPartei, "augenProPartei darf nicht null sein");
        Objects.requireNonNull(siegerPartei, "siegerPartei darf nicht null sein");
        Objects.requireNonNull(spielpunkteProSpieler, "spielpunkteProSpieler darf nicht null sein");
        Objects.requireNonNull(sonderpunkteProPartei, "sonderpunkteProPartei duerfen nicht null sein");
        if (soloMultiplikator != 1 && soloMultiplikator != 3) {
            throw new IllegalArgumentException("soloMultiplikator muss 1 oder 3 sein, war " + soloMultiplikator);
        }

        EnumMap<Partei, Integer> augenKopie = new EnumMap<>(Partei.class);
        augenKopie.putAll(augenProPartei);
        EnumMap<SpielerPosition, Integer> punkteKopie = new EnumMap<>(SpielerPosition.class);
        punkteKopie.putAll(spielpunkteProSpieler);
        EnumMap<Partei, List<SonderpunktEreignis>> sonderpunkteKopie = new EnumMap<>(Partei.class);
        sonderpunkteKopie.putAll(sonderpunkteProPartei);

        if (!augenKopie.keySet().containsAll(EnumSet.allOf(Partei.class))) {
            throw new IllegalArgumentException("Augen muessen fuer beide Parteien vorliegen");
        }
        if (!punkteKopie.keySet().containsAll(EnumSet.allOf(SpielerPosition.class))) {
            throw new IllegalArgumentException("Spielpunkte muessen fuer alle Spieler vorliegen");
        }
        if (!sonderpunkteKopie.keySet().containsAll(EnumSet.allOf(Partei.class))) {
            throw new IllegalArgumentException("Sonderpunkte muessen fuer beide Parteien vorliegen");
        }
        if (spielwert < 1) {
            throw new IllegalArgumentException("Der Spielwert muss positiv sein");
        }
        int gesamtaugen = augenKopie.values().stream().mapToInt(Integer::intValue).sum();
        if (gesamtaugen != 240) {
            throw new IllegalArgumentException("Ein Spiel muss genau 240 Augen ergeben, war aber " + gesamtaugen);
        }
        int nullsumme = punkteKopie.values().stream().mapToInt(Integer::intValue).sum();
        if (nullsumme != 0) {
            throw new IllegalArgumentException("Spielpunkte muessen eine Nullsumme bilden, Summe war " + nullsumme);
        }
        augenProPartei = Map.copyOf(augenKopie);
        spielpunkteProSpieler = Map.copyOf(punkteKopie);
        sonderpunkteProPartei = Map.copyOf(sonderpunkteKopie);
    }

    public int augenVon(Partei partei) {
        return augenProPartei.get(partei);
    }

    public int spielpunkteVon(SpielerPosition spielerPosition) {
        return spielpunkteProSpieler.get(spielerPosition);
    }

    public List<SonderpunktEreignis> sonderpunkteVon(Partei partei) {
        return sonderpunkteProPartei.get(partei);
    }
}
