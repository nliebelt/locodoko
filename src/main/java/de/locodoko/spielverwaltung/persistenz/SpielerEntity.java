package de.locodoko.spielverwaltung.persistenz;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;

@Entity
@Table(name = "spieler")
public class SpielerEntity extends AbstraktePersistenzEntity {

    @NotBlank
    @Column(nullable = false)
    private String name;

    @Column(unique = true)
    private String sessionId;

    @Column(nullable = false)
    private boolean ki;

    /**
     * Zeigt an, ob die KI diesen menschlichen Spieler nach einem Verbindungsabbruch übernommen hat.
     * Wird beim nächsten Spielstart zurückgesetzt.
     */
    @Column(nullable = false)
    private boolean kiUebernommen;

    protected SpielerEntity() {
    }

    private SpielerEntity(String name, String sessionId, boolean ki) {
        this.name = bereinigeName(name);
        this.sessionId = pruefeSessionId(sessionId, ki);
        this.ki = ki;
        this.kiUebernommen = false;
    }

    public static SpielerEntity menschlich(String name, String sessionId) {
        return new SpielerEntity(name, sessionId, false);
    }

    public static SpielerEntity ki(String name) {
        return new SpielerEntity(name, null, true);
    }

    public void aendereName(String name) {
        this.name = bereinigeName(name);
    }

    public String name() {
        return name;
    }

    public String sessionId() {
        return sessionId;
    }

    public boolean istKi() {
        return ki;
    }

    /** Gibt zurück, ob die KI diesen Spieler nach einem Verbindungsabbruch steuert. */
    public boolean istKiUebernommen() {
        return kiUebernommen;
    }

    /** Markiert diesen Spieler als KI-übernommen (nach Reconnect-Timeout). */
    public void markiereAlsKiUebernommen() {
        this.kiUebernommen = true;
    }

    /** Hebt die KI-Übernahme auf — wird beim Spielstart des nächsten Spiels aufgerufen. */
    public void hebeKiUebernahmeAuf() {
        this.kiUebernommen = false;
    }

    /**
     * Setzt die Session-ID auf null, nachdem die HTTP-Session abgelaufen ist.
     * Der Spieler kann sich danach mit einer neuen Session neu registrieren.
     */
    public void nullifiziereSessionId() {
        this.sessionId = null;
    }

    private static String bereinigeName(String name) {
        if (name == null) {
            throw new IllegalArgumentException("name darf nicht null sein");
        }

        String bereinigt = name.trim();
        if (bereinigt.isBlank()) {
            throw new IllegalArgumentException("name darf nicht leer sein");
        }
        return bereinigt;
    }

    private static String pruefeSessionId(String sessionId, boolean ki) {
        if (ki) {
            return null;
        }
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("menschliche Spieler brauchen eine Session-ID");
        }
        return sessionId;
    }
}
