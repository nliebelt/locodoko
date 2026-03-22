package de.locodoko.lobby;

/**
 * Aktueller Zustand eines Tisches in der Lobby.
 *
 * <p>{@code WARTEND}: Tisch ist offen, Spieler koennen beitreten.
 * {@code IM_SPIEL}: Partie laeuft, keine weiteren Beitritte moeglich.
 * {@code BEENDET}: Partie abgeschlossen; Tisch wird nicht mehr angezeigt.</p>
 */
public enum TischStatus {
    WARTEND,
    IM_SPIEL,
    BEENDET
}
