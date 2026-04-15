package de.locodoko.spieler;

import java.util.UUID;

/** Antwort nach erfolgreicher Authentifizierung (Login oder Registrierung). */
public record AuthentifizierungsAntwort(
    UUID spielerId,
    String name,
    String authentifizierungsMethode
) {
    public static AuthentifizierungsAntwort aus(SpielerEntity spieler) {
        return new AuthentifizierungsAntwort(
            spieler.id(),
            spieler.name(),
            spieler.authentifizierungsMethode() != null
                ? spieler.authentifizierungsMethode().name()
                : null
        );
    }
}
