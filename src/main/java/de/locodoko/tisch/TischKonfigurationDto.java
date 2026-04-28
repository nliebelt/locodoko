package de.locodoko.tisch;

import de.locodoko.karten.Spielregeln;
import de.locodoko.tisch.TischkonfigurationEmbeddable;

import io.swagger.v3.oas.annotations.media.Schema;
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
@Schema(description = "Vollstaendige Tischkonfiguration fuer die REST-API.")
public record TischKonfigurationDto(
    @Schema(description = "Ohne Neunen spielen (10er-Deck).")
    boolean ohneNeunen,
    @Schema(description = "Anzahl der Spiele pro Partie.", example = "12")
    @Min(value = 1, message = "Die Anzahl der Spiele muss mindestens 1 sein.")
    int anzahlSpiele,
    @Schema(description = "Hintergrundbild des Tisches.")
    Tischhintergrund tischhintergrund,
    @Schema(description = "Hochzeit als Sonderspiel erlaubt.")
    boolean hochzeitErlaubt,
    @Schema(description = "Armut als Sonderspiel erlaubt.")
    boolean armutErlaubt,
    @Schema(description = "Damensolo als Sonderspiel erlaubt.")
    boolean damensoloErlaubt,
    @Schema(description = "Bubensolo als Sonderspiel erlaubt.")
    boolean bubensoloErlaubt,
    @Schema(description = "Fleischlos als Sonderspiel erlaubt.")
    boolean fleischlosErlaubt,
    @Schema(description = "Trumpfsolo als Sonderspiel erlaubt.")
    boolean trumpfsoloErlaubt,
    @Schema(description = "Zweite Dulle sticht die erste.")
    boolean zweiteDulleSticht,
    @Schema(description = "Sonderpunkt Fuchs gefangen aktiv.")
    boolean fuchsGefangenAktiv,
    @Schema(description = "Sonderpunkt Karlchen aktiv.")
    boolean karlchenAktiv,
    @Schema(description = "Sonderpunkt Doppelkopf aktiv.")
    boolean doppelkopfAktiv,
    @Schema(description = "Mindestkarten fuer Re-/Kontra-Ansage.", example = "1")
    @Min(value = 1, message = "Die Re-/Kontra-Grenze muss mindestens 1 sein.")
    int mindestkartenReKontra,
    @Schema(description = "Mindestkarten fuer Keine-90-Ansage.", example = "1")
    @Min(value = 1, message = "Die Keine-90-Grenze muss mindestens 1 sein.")
    int mindestkartenKeine90,
    @Schema(description = "Mindestkarten fuer Keine-60-Ansage.", example = "1")
    @Min(value = 1, message = "Die Keine-60-Grenze muss mindestens 1 sein.")
    int mindestkartenKeine60,
    @Schema(description = "Mindestkarten fuer Keine-30-Ansage.", example = "1")
    @Min(value = 1, message = "Die Keine-30-Grenze muss mindestens 1 sein.")
    int mindestkartenKeine30,
    @Schema(description = "Mindestkarten fuer Schwarz-Ansage.", example = "1")
    @Min(value = 1, message = "Die Schwarz-Grenze muss mindestens 1 sein.")
    int mindestkartenSchwarz,
    @Schema(description = "Bockrunden aktiv.")
    boolean bockrundenAktiv,
    @Schema(description = "Schweinchen-Sonderregel aktiv.")
    boolean schweinchenAktiv,
    @Schema(description = "Pflichtansage bei dreissig Augen aktiv.")
    boolean dreissigAugenPflichtAktiv,
    @Schema(description = "Schmeissen bei schlechtem Blatt erlaubt.")
    boolean schmeissenAktiv,
    @Schema(description = "Bockrunde 'Herz durchgegangen' nur bei reinen Herz-As-Stichen ausloesen.")
    boolean herzDurchgegangenNurHoch,
    /** Schwierigkeitsstufe der KI-Gegner. Standard: STANDARD. */
    @Schema(description = "Schwierigkeitsstufe der KI-Gegner.")
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
            konfiguration.schmeissenAktiv(),
            konfiguration.herzDurchgegangenNurHoch(),
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
                dreissigAugenPflichtAktiv,
                schmeissenAktiv,
                herzDurchgegangenNurHoch
            ),
            anzahlSpiele,
            tischhintergrund,
            kiSchwierigkeit != null ? kiSchwierigkeit : KiSchwierigkeit.STANDARD
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
