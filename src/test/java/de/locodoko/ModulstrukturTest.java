package de.locodoko;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

/**
 * Verifiziert die Modul-Grenzen der Locodoko-Anwendung.
 *
 * Spring Modulith erkennt jedes Top-Level-Package unter {@code de.locodoko}
 * als eigenständiges Modul und prüft, dass keine verbotenen Cross-Modul-Imports existieren.
 *
 * Erlaubte Abhängigkeiten (laut {@code specs/architektur-ddd.md}):
 * <ul>
 *   <li>{@code tisch → partie, karten, spieler}</li>
 *   <li>{@code ki → partie, karten}</li>
 *   <li>{@code partie → karten}</li>
 *   <li>{@code karten → (nichts)}</li>
 *   <li>{@code spieler → (nichts)}</li>
 *   <li>{@code system → (nichts)}</li>
 * </ul>
 */
class ModulstrukturTest {

    @Test
    void modulGrenzenSindEingehalten() {
        ApplicationModules modules = ApplicationModules.of(LocodokoAnwendung.class);
        modules.verify();
    }
}
