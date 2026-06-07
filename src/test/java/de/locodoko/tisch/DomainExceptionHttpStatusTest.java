package de.locodoko.tisch;

import de.locodoko.karten.UngueltigerSpielzugException;
import de.locodoko.partie.SpielzugKonfliktException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;
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

    @Test
    void optimistischerSperrKonfliktLiefertHttp409MitGleichzeitigerZugriffCode() {
        // WARUM: OptimisticLockingFailureException bei gleichzeitigen Zugversuchen darf NICHT als
        // generischer 500 landen (das wäre ein irreführendes Signal für Client und Monitoring).
        // 409 mit GLEICHZEITIGER_ZUGRIFF erlaubt dem Client, den Snapshot neu zu laden.
        OptimisticLockingFailureException exception = new OptimisticLockingFailureException("Version conflict detected");

        ResponseEntity<ApiFehlerAntwort> response = handler.behandleOptimistischesLock(exception);

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().fehlerCode()).isEqualTo("GLEICHZEITIGER_ZUGRIFF");
    }

    @Test
    void optimistischerSperrKonfliktPerWebSocketLiefertGleichzeitigerZugriffCode() {
        // WARUM: Der WebSocket-Handler muss OptimisticLockingFailureException dediziert abfangen,
        // damit der Client GLEICHZEITIGER_ZUGRIFF statt SERVERFEHLER empfängt — nur so kann
        // das Frontend gezielt einen Snapshot-Reload auslösen statt einen generischen Fehler anzuzeigen.
        SpielverwaltungWebSocketController wsController = new SpielverwaltungWebSocketController(null, null, null, null);
        OptimisticLockingFailureException exception = new OptimisticLockingFailureException("Version conflict");

        SpielverwaltungWebSocketFehlerAntwort antwort = wsController.behandleOptimistischesLock(exception);

        assertThat(antwort.fehlerCode()).isEqualTo("GLEICHZEITIGER_ZUGRIFF");
        assertThat(antwort.nachricht()).contains("neu laden");
    }
}
