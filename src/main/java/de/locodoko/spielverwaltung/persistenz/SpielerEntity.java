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

    protected SpielerEntity() {
    }

    private SpielerEntity(String name, String sessionId, boolean ki) {
        this.name = bereinigeName(name);
        this.sessionId = pruefeSessionId(sessionId, ki);
        this.ki = ki;
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
