package de.locodoko.session;

import de.locodoko.partie.Ansage;

/**
 * WebSocket-Anfrage zum Ansagen/Absagen ({@code /app/tisch/{id}/ansage}).
 *
 * @param ansage  die zu taetigende Ansage (z.B. RE, KONTRA, KEINE_90)
 */
public record AnsageAnfrage(Ansage ansage) {
}
