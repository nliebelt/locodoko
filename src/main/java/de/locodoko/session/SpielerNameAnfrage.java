package de.locodoko.session;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SpielerNameAnfrage(
    @NotBlank(message = "name darf nicht leer sein")
    @Size(max = 40, message = "name darf hoechstens 40 Zeichen lang sein")
    String name
) {
}
