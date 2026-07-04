package de.locodoko.spieler;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** SHA-256-Hash für Einweg-Tokens (Email-Verifizierung, Passwort-Reset). */
final class TokenHasher {

    private TokenHasher() {}

    /** Gibt den SHA-256-Hex-Hash des Tokens zurück. */
    static String sha256(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 nicht verfügbar", e);
        }
    }
}
