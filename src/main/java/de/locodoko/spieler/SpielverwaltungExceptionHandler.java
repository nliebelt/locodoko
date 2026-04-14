package de.locodoko.spieler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * Zentraler Exception-Handler fuer alle REST-Controller der Spielverwaltung.
 *
 * <p>Wandelt fachliche Exceptions ({@link SpielerSessionUngueltigException},
 * {@link SpielerNameAenderungNichtErlaubtException}, {@link SpielverwaltungNichtGefundenException},
 * {@link SpielverwaltungKonfliktException}) in strukturierte {@link ApiFehlerAntwort}-JSON-Antworten
 * mit passenden HTTP-Statuscodes (401, 403, 404, 409) um und logt Fehler-Details.</p>
 */
@RestControllerAdvice
public class SpielverwaltungExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(SpielverwaltungExceptionHandler.class);

    @ExceptionHandler(SpielerSessionUngueltigException.class)
    public ResponseEntity<ApiFehlerAntwort> behandleUngueltigeSession(SpielerSessionUngueltigException exception) {
        LOGGER.warn("Ungueltige Spieler-Session: {}", exception.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(new ApiFehlerAntwort(exception.fehlerCode(), exception.getMessage()));
    }

    @ExceptionHandler(SpielerNameAenderungNichtErlaubtException.class)
    public ResponseEntity<ApiFehlerAntwort> behandleUngueltigeNamensaenderung(
        SpielerNameAenderungNichtErlaubtException exception
    ) {
        LOGGER.warn("Nicht erlaubte Namensaenderung: {}", exception.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ApiFehlerAntwort(exception.fehlerCode(), exception.getMessage()));
    }

    @ExceptionHandler(SpielverwaltungNichtGefundenException.class)
    public ResponseEntity<ApiFehlerAntwort> behandleNichtGefunden(SpielverwaltungNichtGefundenException exception) {
        LOGGER.warn("Ressource nicht gefunden: {}", exception.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ApiFehlerAntwort(exception.fehlerCode(), exception.getMessage()));
    }

    @ExceptionHandler(SpielverwaltungKonfliktException.class)
    public ResponseEntity<ApiFehlerAntwort> behandleKonflikt(SpielverwaltungKonfliktException exception) {
        LOGGER.warn("Fachlicher Konflikt: {}", exception.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ApiFehlerAntwort(exception.fehlerCode(), exception.getMessage()));
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
    public ResponseEntity<ApiFehlerAntwort> behandleUngueltigeAnfrage(Exception exception) {
        String nachricht = exception instanceof MethodArgumentNotValidException validationException
            ? validationException.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "))
            : exception.getMessage();

        LOGGER.warn("Ungueltige Anfrage: {}", nachricht);
        return ResponseEntity.badRequest().body(new ApiFehlerAntwort("ANFRAGE_UNGUELTIG", nachricht));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiFehlerAntwort> behandleServerfehler(Exception exception) {
        LOGGER.error("Unerwarteter Serverfehler", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ApiFehlerAntwort("SERVERFEHLER", "Es ist ein unerwarteter Serverfehler aufgetreten."));
    }
}
