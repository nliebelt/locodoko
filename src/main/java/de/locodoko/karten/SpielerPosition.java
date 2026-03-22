package de.locodoko.karten;

import java.util.List;

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
