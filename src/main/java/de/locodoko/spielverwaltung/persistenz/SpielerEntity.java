package de.locodoko.spielverwaltung.persistenz;

import jakarta.validation.constraints.NotBlank;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

/**
 * Persistenz-Entity fuer einen Spieler (menschlich oder KI).
 * Aggregate Root: Spieler werden unabhaengig von Tischen und Partien gespeichert.
 */
@Table("spieler")
public class SpielerEntity extends AbstraktePersistenzEntity {

    @NotBlank
    @Column("name")
    private String name;

    @Column("session_id")
    private String sessionId;

    @Column("ki")
    private boolean ki;

    /**
     * Zeigt an, ob die KI diesen menschlichen Spieler nach einem Verbindungsabbruch uebernommen hat.
     * Wird beim naechsten Spielstart zurueckgesetzt.
     */
    @Column("ki_uebernommen")
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

    /** Gibt zurueck, ob die KI diesen Spieler nach einem Verbindungsabbruch steuert. */
    public boolean istKiUebernommen() {
        return kiUebernommen;
    }

    /** Markiert diesen Spieler als KI-uebernommen (nach Reconnect-Timeout). */
    public void markiereAlsKiUebernommen() {
        this.kiUebernommen = true;
    }

    /** Hebt die KI-Uebernahme auf — wird beim Spielstart des naechsten Spiels aufgerufen. */
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
