package de.locodoko.lobby;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TischErstellenAnfrage(
    @NotBlank(message = "Der Tischname darf nicht leer sein.")
    @Size(max = 100, message = "Der Tischname darf hoechstens 100 Zeichen enthalten.")
    String name,
    @Valid TischKonfigurationDto konfiguration
) {
}
