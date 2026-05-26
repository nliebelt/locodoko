package de.locodoko.tisch;

import de.locodoko.karten.UngueltigerSpielzugException;
import de.locodoko.partie.SpielzugKonfliktException;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Prueft, dass der {@link SpielverwaltungExceptionHandler} Domain-Exceptions
 * auf die fachlich korrekten HTTP-Statuscodes abbildet.
 *
 * <p>WARUM: Die Unterscheidung zwischen HTTP 409 (Zustandskonflikt) und HTTP 422
 * (Regelverstoß) ist für Client-seitige Fehlerbehandlung wichtig.
 * Ein Phase-Fehler (409) soll dem Client ermöglichen, den aktuellen Spielstand
 * neu zu laden; ein Regelverstoß (422) signalisiert, dass der Zug schlicht
 * nicht erlaubt war.</p>
 */
class DomainExceptionHttpStatusTest {

    private final SpielverwaltungExceptionHandler handler = new SpielverwaltungExceptionHandler();

    @Test
    void regelverstoßLiefertHttp422() {
        // WARUM: UngueltigerSpielzugException repräsentiert einen Spielzug gegen die Doppelkopf-Regeln
        // (Bedienpflicht, Pflichtansage ausstehend etc.) — muss 422 liefern, nicht 400 oder 409.
        UngueltigerSpielzugException exception = new UngueltigerSpielzugException("Bedienpflicht verletzt");

        ResponseEntity<ApiFehlerAntwort> response = handler.behandleRegelverstoß(exception);

        assertThat(response.getStatusCode().value()).isEqualTo(422);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().fehlerCode()).isEqualTo("SPIELZUG_UNGUELTIG");
        assertThat(response.getBody().nachricht()).isEqualTo("Bedienpflicht verletzt");
    }

    @Test
    void zustandskonfliktLiefertHttp409() {
        // WARUM: SpielverwaltungKonfliktException repräsentiert einen Konflikt mit dem
        // aktuellen Zustand (Partie bereits beendet, falscher Spieler etc.) — muss 409 liefern.
        SpielverwaltungKonfliktException exception = new SpielverwaltungKonfliktException("PARTIE_BEENDET", "Die Partie ist bereits beendet");

        ResponseEntity<ApiFehlerAntwort> response = handler.behandleKonflikt(exception);

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().fehlerCode()).isEqualTo("PARTIE_BEENDET");
    }
}
