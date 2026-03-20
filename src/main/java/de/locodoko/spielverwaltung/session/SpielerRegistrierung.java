package de.locodoko.spielverwaltung.session;

import de.locodoko.spielverwaltung.persistenz.SpielerEntity;

public record SpielerRegistrierung(SpielerEntity spieler, boolean neuAngelegt) {
}
