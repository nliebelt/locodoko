package de.locodoko.spielverwaltung.session;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class SpielverwaltungExceptionHandler {

    @ExceptionHandler(SpielerSessionUngueltigException.class)
    public ResponseEntity<ApiFehlerAntwort> behandleUngueltigeSession(SpielerSessionUngueltigException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(new ApiFehlerAntwort("SPIELER_SESSION_UNGUELTIG", exception.getMessage()));
    }

    @ExceptionHandler(SpielerNameAenderungNichtErlaubtException.class)
    public ResponseEntity<ApiFehlerAntwort> behandleUngueltigeNamensaenderung(
        SpielerNameAenderungNichtErlaubtException exception
    ) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ApiFehlerAntwort("SPIELER_NAME_AENDERUNG_NICHT_ERLAUBT", exception.getMessage()));
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
    public ResponseEntity<ApiFehlerAntwort> behandleUngueltigeAnfrage(Exception exception) {
        String nachricht = exception instanceof MethodArgumentNotValidException validationException
            ? validationException.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "))
            : exception.getMessage();

        return ResponseEntity.badRequest().body(new ApiFehlerAntwort("ANFRAGE_UNGUELTIG", nachricht));
    }
}
