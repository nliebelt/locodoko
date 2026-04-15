package de.locodoko.spieler;

import de.locodoko.system.AbstraktePersistenzEntity;

import jakarta.validation.constraints.NotBlank;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

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

    /** Art der Authentifizierung (OAUTH2_GOOGLE, PASSWORT). Null bei Gast-Spielern (alter Flow). */
    @Column("authentifizierungs_methode")
    private String authentifizierungsMethode;

    /** OAuth2-Subject-ID (z.B. Google-sub). Null bei Passwort-Auth. */
    @Column("external_id")
    private String externalId;

    /** Eindeutiger Benutzername (3–20 Zeichen). Null bei OAuth2-Spielern ohne eigenen Benutzernamen. */
    @Column("benutzername")
    private String benutzername;

    /** BCrypt-gehashtes Passwort. Null bei OAuth2 oder Gast. */
    @Column("passwort_hash")
    private String passwortHash;

    /** Optionale E-Mail-Adresse. */
    @Column("email")
    private String email;

    /** Oeffentlicher Anzeigename (2–20 Zeichen, doppelt erlaubt). Null → name wird verwendet. */
    @Column("anzeige_name")
    private String anzeigeName;

    /** Avatar-Farbe als Hex-String (z.B. "#e63946"). Null → zufaellige Standardfarbe. */
    @Column("avatar_farbe")
    private String avatarFarbe;

    private static final List<String> AVATAR_FARBEN = List.of(
        "#e63946", "#457b9d", "#2a9d8f", "#e9c46a", "#f4a261",
        "#264653", "#6a4c93", "#1982c4", "#8ac926", "#ff595e",
        "#ffca3a", "#6a0572"
    );

    protected SpielerEntity() {
    }

    private SpielerEntity(String name, String sessionId, boolean ki) {
        this.name = bereinigeName(name);
        this.sessionId = pruefeSessionId(sessionId, ki);
        this.ki = ki;
        this.kiUebernommen = false;
        this.avatarFarbe = zufaelligeFarbe();
    }

    public static SpielerEntity menschlich(String name, String sessionId) {
        return new SpielerEntity(name, sessionId, false);
    }

    public static SpielerEntity ki(String name) {
        return new SpielerEntity(name, null, true);
    }

    /** Erzeugt einen Spieler via Passwort-Registrierung. Session wird spaeter per {@link #setzeSessionId} gesetzt. */
    public static SpielerEntity mitPasswort(String benutzername, String passwortHash, String email) {
        SpielerEntity spieler = new SpielerEntity();
        spieler.name = bereinigeName(benutzername);
        spieler.ki = false;
        spieler.kiUebernommen = false;
        spieler.authentifizierungsMethode = AuthentifizierungsMethode.PASSWORT.name();
        spieler.benutzername = benutzername;
        spieler.passwortHash = passwortHash;
        spieler.email = email;
        spieler.avatarFarbe = zufaelligeFarbe();
        return spieler;
    }

    /** Erzeugt oder aktualisiert einen Spieler via OAuth2 (Google). Session wird spaeter per {@link #setzeSessionId} gesetzt. */
    public static SpielerEntity mitOauth2(String externalId, String email, String name) {
        SpielerEntity spieler = new SpielerEntity();
        spieler.name = bereinigeName(name);
        spieler.ki = false;
        spieler.kiUebernommen = false;
        spieler.authentifizierungsMethode = AuthentifizierungsMethode.OAUTH2_GOOGLE.name();
        spieler.externalId = externalId;
        spieler.email = email;
        spieler.avatarFarbe = zufaelligeFarbe();
        return spieler;
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

    public AuthentifizierungsMethode authentifizierungsMethode() {
        return authentifizierungsMethode != null
            ? AuthentifizierungsMethode.valueOf(authentifizierungsMethode)
            : null;
    }

    public String externalId() {
        return externalId;
    }

    public String benutzername() {
        return benutzername;
    }

    public String passwortHash() {
        return passwortHash;
    }

    public String email() {
        return email;
    }

    /** Setzt die Session-ID (wird nach Login gesetzt, damit der alte Session-Flow weiterhin funktioniert). */
    public void setzeSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    /**
     * Setzt die Session-ID auf null, nachdem die HTTP-Session abgelaufen ist.
     * Der Spieler kann sich danach mit einer neuen Session neu registrieren.
     */
    public void nullifiziereSessionId() {
        this.sessionId = null;
    }

    /** Liefert den Anzeigenamen — faellt auf {@link #name()} zurueck wenn nicht gesetzt. */
    public String anzeigeName() {
        return anzeigeName != null ? anzeigeName : name;
    }

    /** Setzt den Anzeigenamen (2–20 Zeichen). */
    public void setzeAnzeigeName(String anzeigeName) {
        if (anzeigeName == null || anzeigeName.trim().length() < 2 || anzeigeName.trim().length() > 20) {
            throw new IllegalArgumentException("anzeigeName muss 2–20 Zeichen lang sein");
        }
        this.anzeigeName = anzeigeName.trim();
    }

    public String avatarFarbe() {
        return avatarFarbe != null ? avatarFarbe : AVATAR_FARBEN.getFirst();
    }

    public void setzeAvatarFarbe(String avatarFarbe) {
        if (avatarFarbe != null && !avatarFarbe.matches("^#[0-9a-fA-F]{6}$")) {
            throw new IllegalArgumentException("avatarFarbe muss ein gueltiger Hex-Farbwert sein (z.B. #e63946)");
        }
        this.avatarFarbe = avatarFarbe;
    }

    private static String zufaelligeFarbe() {
        return AVATAR_FARBEN.get(ThreadLocalRandom.current().nextInt(AVATAR_FARBEN.size()));
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
