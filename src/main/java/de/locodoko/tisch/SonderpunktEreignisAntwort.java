package de.locodoko.tisch;

import de.locodoko.partie.SpielerPosition;
import org.springframework.lang.Nullable;

public record SonderpunktEreignisAntwort(
    String typ,
    SpielerPosition gewinner,
    @Nullable SpielerPosition verlierer
) {}
