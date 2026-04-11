package de.locodoko.partie;

import java.util.UUID;

/** Typisierte ID fuer ein Spiel — verhindert Verwechslung mit PartieId oder TischId. */
public record SpielId(UUID wert) {

    public SpielId {
        if (wert == null) throw new IllegalArgumentException("SpielId.wert darf nicht null sein");
    }

    public static SpielId neu() {
        return new SpielId(UUID.randomUUID());
    }

    public static SpielId von(UUID wert) {
        return new SpielId(wert);
    }

    public static SpielId von(String wert) {
        return von(UUID.fromString(wert));
    }

    @Override
    public String toString() {
        return wert.toString();
    }
}
