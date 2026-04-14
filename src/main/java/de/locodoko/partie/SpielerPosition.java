package de.locodoko.partie;

import java.util.List;

/**
 * Sitzposition eines Spielers am Doppelkopf-Tisch.
 *
 * <p>Die vier Positionen am Tisch sind im Uhrzeigersinn angeordnet: Sued, West, Nord, Ost.
 * Die Position entscheidet ueber Ausspiel-Reihenfolge, Geberrotation und die relative
 * Darstellung in der Tischansicht (der menschliche Spieler sitzt immer unten/Sued).</p>
 */
public enum SpielerPosition {
    SUED,
    WEST,
    NORD,
    OST;

    private static final List<SpielerPosition> UHRZEIGERSINN = List.of(SUED, WEST, NORD, OST);

    public SpielerPosition naechsteImUhrzeigersinn() {
        int index = UHRZEIGERSINN.indexOf(this);
        return UHRZEIGERSINN.get((index + 1) % UHRZEIGERSINN.size());
    }

    public static List<SpielerPosition> imUhrzeigersinnAb(SpielerPosition start) {
        int startIndex = UHRZEIGERSINN.indexOf(start);
        return List.of(
            UHRZEIGERSINN.get(startIndex),
            UHRZEIGERSINN.get((startIndex + 1) % UHRZEIGERSINN.size()),
            UHRZEIGERSINN.get((startIndex + 2) % UHRZEIGERSINN.size()),
            UHRZEIGERSINN.get((startIndex + 3) % UHRZEIGERSINN.size())
        );
    }

    public static List<SpielerPosition> standardReihenfolge() {
        return UHRZEIGERSINN;
    }
}
