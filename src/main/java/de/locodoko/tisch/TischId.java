package de.locodoko.tisch;

import java.util.UUID;

/** Typisierte ID fuer einen Tisch — verhindert Verwechslung mit PartieId oder SpielerId. */
public record TischId(UUID wert) {

    public TischId {
        if (wert == null) throw new IllegalArgumentException("TischId.wert darf nicht null sein");
    }

    public static TischId neu() {
        return new TischId(UUID.randomUUID());
    }

    public static TischId von(UUID wert) {
        return new TischId(wert);
    }

    public static TischId von(String wert) {
        return von(UUID.fromString(wert));
    }

    @Override
    public String toString() {
        return wert.toString();
    }
}
