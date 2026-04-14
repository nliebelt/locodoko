package de.locodoko.tisch;

/**
 * Mögliche Verbindungsstatus-Übergänge eines Spielers am Tisch.
 * Wird als Teil von {@link VerbindungStatusEreignisAntwort} an andere Spieler gesendet.
 */
public enum VerbindungsstatusTyp {

    /** Spieler hat sich erfolgreich verbunden oder reconnected. */
    VERBUNDEN,

    /** Spieler hat die Verbindung verloren — Reconnect-Timeout läuft. */
    GETRENNT,

    /** KI hat die Steuerung übernommen, nachdem der Reconnect-Timeout abgelaufen ist. */
    KI_UEBERNOMMEN
}
