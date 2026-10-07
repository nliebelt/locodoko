package de.locodoko.tisch;

import de.locodoko.karten.UngueltigerSpielzugException;
import de.locodoko.spieler.SpielerSessionUngueltigException;
import de.locodoko.spieler.SpielerZugriffVerweigertException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import static org.assertj.core.api.Assertions.assertThat;

class SpielverwaltungExceptionHandlerTest {

    private final SpielverwaltungExceptionHandler handler = new SpielverwaltungExceptionHandler();

    @Test
    void ungueltigeSessionLiefert401() {
        var ex = new SpielerSessionUngueltigException("Session abgelaufen");
        var response = handler.behandleUngueltigeSession(ex);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().fehlerCode()).isEqualTo("SPIELER_SESSION_UNGUELTIG");
    }

    @Test
    void zugriffVerweigertLiefert403() {
        var ex = new SpielerZugriffVerweigertException("Kein Zugriff");
        var response = handler.behandleZugriffVerweigert(ex);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().fehlerCode()).isEqualTo("ZUGRIFF_VERWEIGERT");
    }

    @Test
    void nichtGefundenLiefert404() {
        var ex = new SpielverwaltungNichtGefundenException("TISCH_NICHT_GEFUNDEN", "kein Tisch");
        var response = handler.behandleNichtGefunden(ex);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().fehlerCode()).isEqualTo("TISCH_NICHT_GEFUNDEN");
    }

    @Test
    void konfliktLiefert409() {
        var ex = new SpielverwaltungKonfliktException("TISCH_VOLL", "voll");
        var response = handler.behandleKonflikt(ex);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().fehlerCode()).isEqualTo("TISCH_VOLL");
    }

    @Test
    void regelverstoßLiefert422() {
        var ex = new UngueltigerSpielzugException("Karte nicht erlaubt");
        var response = handler.behandleRegelverstoß(ex);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody().fehlerCode()).isEqualTo("SPIELZUG_UNGUELTIG");
    }

    @Test
    void optimistischesLockLiefert409() {
        var ex = new OptimisticLockingFailureException("Version conflict");
        var response = handler.behandleOptimistischesLock(ex);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().fehlerCode()).isEqualTo("GLEICHZEITIGER_ZUGRIFF");
    }

    @Test
    void illegalArgumentLiefert400MitNachricht() {
        var ex = new IllegalArgumentException("Ungueltige Eingabe");
        var response = handler.behandleUngueltigeAnfrage(ex);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().fehlerCode()).isEqualTo("ANFRAGE_UNGUELTIG");
        assertThat(response.getBody().nachricht()).isEqualTo("Ungueltige Eingabe");
    }

    @Test
    void validationExceptionLiefert400MitFeldFehlern() {
        var bindingResult = new BeanPropertyBindingResult(new Object(), "obj");
        bindingResult.addError(new FieldError("obj", "text", "Pflichtfeld leer"));
        var ex = new MethodArgumentNotValidException(null, bindingResult);
        var response = handler.behandleUngueltigeAnfrage(ex);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().fehlerCode()).isEqualTo("ANFRAGE_UNGUELTIG");
        assertThat(response.getBody().nachricht()).contains("Pflichtfeld leer");
    }

    @Test
    void unbekannteExceptionLiefert500() {
        var ex = new RuntimeException("Unbekannt");
        var response = handler.behandleServerfehler(ex);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().fehlerCode()).isEqualTo("SERVERFEHLER");
    }
}
