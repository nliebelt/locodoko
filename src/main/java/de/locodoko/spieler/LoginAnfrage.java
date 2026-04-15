package de.locodoko.spieler;

import jakarta.validation.constraints.NotBlank;

/** Anfrage fuer den Login mit Benutzername und Passwort. */
public record LoginAnfrage(
    @NotBlank String benutzername,
    @NotBlank String passwort
) {}
