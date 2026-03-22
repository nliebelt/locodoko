package de.locodoko.session;

import de.locodoko.session.SpielerEntity;

/**
 * Ergebnis einer Session-Registrierung oder -Wiederherstellung.
 *
 * <p>Wird intern von {@link SpielerSessionService} zurueckgegeben, um zu unterscheiden,
 * ob ein Spieler neu angelegt wurde ({@code neuAngelegt = true}) oder eine bestehende
 * Session wiederhergestellt wurde.</p>
 *
 * @param spieler      der zugeordnete Spieler
 * @param neuAngelegt  {@code true}, wenn der Spieler in dieser Anfrage neu erstellt wurde
 */
public record SpielerRegistrierung(SpielerEntity spieler, boolean neuAngelegt) {
}
