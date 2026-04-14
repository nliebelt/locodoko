package de.locodoko.spieler;

import java.util.UUID;

/** Typisierte ID fuer einen Spieler — verhindert Verwechslung mit TischId oder PartieId. */
public record SpielerId(UUID wert) {

    public SpielerId {
        if (wert == null) throw new IllegalArgumentException("SpielerId.wert darf nicht null sein");
    }

    public static SpielerId neu() {
        return new SpielerId(UUID.randomUUID());
    }

    public static SpielerId von(UUID wert) {
        return new SpielerId(wert);
    }

    public static SpielerId von(String wert) {
        return von(UUID.fromString(wert));
    }

    @Override
    public String toString() {
        return wert.toString();
    }
}
