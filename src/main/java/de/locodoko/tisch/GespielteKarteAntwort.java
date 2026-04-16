package de.locodoko.tisch;

import de.locodoko.partie.SpielerPosition;

public record GespielteKarteAntwort(SpielerPosition spielerPosition, String karteId) {}
