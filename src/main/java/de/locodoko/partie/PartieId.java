package de.locodoko.partie;

import java.util.UUID;

/** Typisierte ID fuer eine Partie — verhindert Verwechslung mit TischId oder SpielerId. */
public record PartieId(UUID wert) {

    public PartieId {
        if (wert == null) throw new IllegalArgumentException("PartieId.wert darf nicht null sein");
    }

    public static PartieId neu() {
        return new PartieId(UUID.randomUUID());
    }

    public static PartieId von(UUID wert) {
        return new PartieId(wert);
    }

    public static PartieId von(String wert) {
        return von(UUID.fromString(wert));
    }

    @Override
    public String toString() {
        return wert.toString();
    }
}
