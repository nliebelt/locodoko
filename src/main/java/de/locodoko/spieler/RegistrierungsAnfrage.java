package de.locodoko.spieler;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Anfrage fuer die Registrierung mit Benutzername und Passwort. */
public record RegistrierungsAnfrage(
    @NotBlank @Size(min = 3, max = 20) String benutzername,
    @NotBlank @Size(min = 8) String passwort,
    String email
) {}
