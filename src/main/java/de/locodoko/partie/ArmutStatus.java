package de.locodoko.partie;

import de.locodoko.karten.Karte;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Zustand des laufenden Armut-Tauschs.
 *
 * <p>Ein Spieler mit hoechstens drei Truempfen darf Armut melden. Dann bietet er alle
 * seine Truempfe an; die anderen Spieler werden der Reihe nach links von ihm gefragt,
 * ob sie annehmen moechten. Der annehmende Spieler gibt gleich viele Karten zurueck
 * und wird Re-Partner. Nimmt niemand an, wird das Spiel neu eingeworfen.</p>
 *
 * @param armutSpieler          Spieler, der Armut gemeldet hat
 * @param abfrageReihenfolge    die drei potentiellen Antwortspieler, links im Uhrzeigersinn
 * @param aktuellerIndex        Index des aktuell befragten Spielers in abfrageReihenfolge
 * @param angeboteneTrumpfkarten die vom Armut-Spieler angebotenen Trumpfkarten
 * @param angebotAbgegeben      ob das Angebot bereits abgegeben wurde
 * @param partnerSpieler        der annehmende Spieler, oder {@code null} waehrend der Suche
 */
public record ArmutStatus(
    SpielerPosition armutSpieler,
    List<SpielerPosition> abfrageReihenfolge,
    int aktuellerIndex,
    List<Karte> angeboteneTrumpfkarten,
    boolean angebotAbgegeben,
    SpielerPosition partnerSpieler
) {

    public ArmutStatus {
        Objects.requireNonNull(armutSpieler, "armutSpieler darf nicht null sein");
        Objects.requireNonNull(abfrageReihenfolge, "abfrageReihenfolge darf nicht null sein");
        Objects.requireNonNull(angeboteneTrumpfkarten, "angeboteneTrumpfkarten duerfen nicht null sein");
        if (abfrageReihenfolge.size() != 3) {
            throw new IllegalArgumentException("Die Armut-Abfrage braucht genau drei moegliche Antwortspieler");
        }
        if (aktuellerIndex < 0 || aktuellerIndex > abfrageReihenfolge.size()) {
            throw new IllegalArgumentException("aktuellerIndex liegt ausserhalb der gueltigen Abfrage-Reihenfolge");
        }
        if (partnerSpieler != null && !angebotAbgegeben) {
            throw new IllegalArgumentException("Ein Partner kann erst nach einem abgegebenen Angebot feststehen");
        }
    }

    public static ArmutStatus gestartet(SpielerPosition armutSpieler) {
        Objects.requireNonNull(armutSpieler, "armutSpieler darf nicht null sein");
        List<SpielerPosition> abfrageReihenfolge = SpielerPosition.imUhrzeigersinnAb(armutSpieler.naechsteImUhrzeigersinn()).stream()
            .filter(position -> position != armutSpieler)
            .toList();
        return new ArmutStatus(armutSpieler, abfrageReihenfolge, 0, List.of(), false, null);
    }

    public Optional<SpielerPosition> aktuellerAntwortspieler() {
        if (!angebotAbgegeben || partnerSpieler != null || aktuellerIndex >= abfrageReihenfolge.size()) {
            return Optional.empty();
        }
        return Optional.of(abfrageReihenfolge.get(aktuellerIndex));
    }

    public boolean angebotLiegtVor() {
        return angebotAbgegeben;
    }

    public boolean alleAntwortenErschoepft() {
        return angebotAbgegeben && partnerSpieler == null && aktuellerIndex >= abfrageReihenfolge.size();
    }

    public Optional<SpielerPosition> partner() {
        return Optional.ofNullable(partnerSpieler);
    }

    public ArmutStatus mitAngebot(List<Karte> angeboteneTrumpfkarten) {
        Objects.requireNonNull(angeboteneTrumpfkarten, "angeboteneTrumpfkarten duerfen nicht null sein");
        if (angebotAbgegeben) {
            throw new IllegalStateException("Das Armut-Angebot wurde bereits abgegeben");
        }
        return new ArmutStatus(armutSpieler, abfrageReihenfolge, aktuellerIndex, List.copyOf(angeboteneTrumpfkarten), true, null);
    }

    public ArmutStatus mitAblehnung(SpielerPosition spielerPosition) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        SpielerPosition erwarteterSpieler = aktuellerAntwortspieler()
            .orElseThrow(() -> new IllegalStateException("Aktuell wartet die Armut auf keine weitere Antwort"));
        if (spielerPosition != erwarteterSpieler) {
            throw new IllegalStateException("Ablehnung wurde von " + spielerPosition + " gemeldet, erwartet war " + erwarteterSpieler);
        }
        return new ArmutStatus(armutSpieler, abfrageReihenfolge, aktuellerIndex + 1, angeboteneTrumpfkarten, true, null);
    }

    public ArmutStatus mitPartner(SpielerPosition partnerSpieler) {
        Objects.requireNonNull(partnerSpieler, "partnerSpieler darf nicht null sein");
        SpielerPosition erwarteterSpieler = aktuellerAntwortspieler()
            .orElseThrow(() -> new IllegalStateException("Aktuell kann kein Partner mehr angenommen werden"));
        if (partnerSpieler != erwarteterSpieler) {
            throw new IllegalStateException("Partner wurde von " + partnerSpieler + " bestaetigt, erwartet war " + erwarteterSpieler);
        }
        return new ArmutStatus(armutSpieler, abfrageReihenfolge, aktuellerIndex, angeboteneTrumpfkarten, true, partnerSpieler);
    }
}
