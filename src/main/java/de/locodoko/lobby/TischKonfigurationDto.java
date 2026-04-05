package de.locodoko.lobby;

import de.locodoko.karten.Spielregeln;
import de.locodoko.lobby.TischkonfigurationEmbeddable;
import de.locodoko.partie.ki.KiSchwierigkeit;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;

/**
 * Datentransferobjekt fuer die vollstaendige Tischkonfiguration (REST-API).
 *
 * <p>Wird sowohl beim Lesen ({@code GET /api/tische/{id}}) als auch beim Aktualisieren
 * ({@code PUT /api/tische/{id}/konfiguration}) verwendet. Validierungsannotationen
 * sichern Mindestgrenzen fuer Spielanzahl und Ansagegrenzen; {@link #sindAnsagegrenzenGueltig()}
 * prueft zusaetzlich die logische Stufenreihenfolge der Ansagegrenzen.</p>
 */
public record TischKonfigurationDto(
    boolean ohneNeunen,
    @Min(value = 1, message = "Die Anzahl der Spiele muss mindestens 1 sein.")
    int anzahlSpiele,
    Tischhintergrund tischhintergrund,
    boolean hochzeitErlaubt,
    boolean armutErlaubt,
    boolean damensoloErlaubt,
    boolean bubensoloErlaubt,
    boolean fleischlosErlaubt,
    boolean trumpfsoloErlaubt,
    boolean zweiteDulleSticht,
    boolean fuchsGefangenAktiv,
    boolean karlchenAktiv,
    boolean doppelkopfAktiv,
    @Min(value = 1, message = "Die Re-/Kontra-Grenze muss mindestens 1 sein.")
    int mindestkartenReKontra,
    @Min(value = 1, message = "Die Keine-90-Grenze muss mindestens 1 sein.")
    int mindestkartenKeine90,
    @Min(value = 1, message = "Die Keine-60-Grenze muss mindestens 1 sein.")
    int mindestkartenKeine60,
    @Min(value = 1, message = "Die Keine-30-Grenze muss mindestens 1 sein.")
    int mindestkartenKeine30,
    @Min(value = 1, message = "Die Schwarz-Grenze muss mindestens 1 sein.")
    int mindestkartenSchwarz,
    boolean bockrundenAktiv,
    boolean schweinchenAktiv,
    boolean dreissigAugenPflichtAktiv,
    /** Schwierigkeitsstufe der KI-Gegner. Standard: STANDARD. */
    KiSchwierigkeit kiSchwierigkeit
) {

    public static TischKonfigurationDto aus(TischkonfigurationEmbeddable konfiguration) {
        return new TischKonfigurationDto(
            konfiguration.ohneNeunen(),
            konfiguration.anzahlSpiele(),
            konfiguration.tischhintergrund(),
            konfiguration.hochzeitErlaubt(),
            konfiguration.armutErlaubt(),
            konfiguration.damensoloErlaubt(),
            konfiguration.bubensoloErlaubt(),
            konfiguration.fleischlosErlaubt(),
            konfiguration.trumpfsoloErlaubt(),
            konfiguration.zweiteDulleSticht(),
            konfiguration.fuchsGefangenAktiv(),
            konfiguration.karlchenAktiv(),
            konfiguration.doppelkopfAktiv(),
            konfiguration.mindestkartenReKontra(),
            konfiguration.mindestkartenKeine90(),
            konfiguration.mindestkartenKeine60(),
            konfiguration.mindestkartenKeine30(),
            konfiguration.mindestkartenSchwarz(),
            konfiguration.bockrundenAktiv(),
            konfiguration.schweinchenAktiv(),
            konfiguration.dreissigAugenPflichtAktiv(),
            konfiguration.kiSchwierigkeit()
        );
    }

    public TischkonfigurationEmbeddable alsEmbeddable() {
        return TischkonfigurationEmbeddable.ausSpielregeln(
            new Spielregeln(
                ohneNeunen,
                zweiteDulleSticht,
                mindestkartenReKontra,
                mindestkartenKeine90,
                mindestkartenKeine60,
                mindestkartenKeine30,
                mindestkartenSchwarz,
                fuchsGefangenAktiv,
                karlchenAktiv,
                doppelkopfAktiv,
                armutErlaubt,
                damensoloErlaubt,
                bubensoloErlaubt,
                trumpfsoloErlaubt,
                fleischlosErlaubt,
                hochzeitErlaubt,
                bockrundenAktiv,
                schweinchenAktiv,
                dreissigAugenPflichtAktiv
            ),
            anzahlSpiele,
            tischhintergrund,
            kiSchwierigkeit != null ? kiSchwierigkeit : de.locodoko.partie.ki.KiSchwierigkeit.STANDARD
        );
    }

    @AssertTrue(message = "Die Ansagegrenzen muessen ein gueltiges Regelwerk bilden.")
    public boolean sindAnsagegrenzenGueltig() {
        try {
            alsEmbeddable().alsSpielregeln();
            return true;
        } catch (IllegalArgumentException ausnahme) {
            return false;
        }
    }
}
