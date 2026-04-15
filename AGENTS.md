# Locodoko — Entdeckte Gotchas

Build-Befehle und Architektur: siehe CLAUDE.md (wird automatisch geladen).

## Spring Boot 4 / Java 25 Migration (2026-03-29)

- `export JAVA_HOME=/usr/lib/jvm/temurin-25-jdk-arm64` nötig, da JAVA_HOME nicht gesetzt ist
- SB4 hat `@AutoConfigureMockMvc` entfernt → `MockMvcBuilders.webAppContextSetup(wac).build()` in `@BeforeEach`
- SB4 hat `TestRestTemplate` entfernt → plain `RestTemplate` + `@LocalServerPort` für RANDOM_PORT-Tests
- SB4 verwendet Jackson 3 (`tools.jackson.databind.ObjectMapper`), nicht mehr `com.fasterxml.jackson`
- SB4: `liquibase-core` allein reicht nicht → `spring-boot-starter-liquibase` nötig (Autoconfig eigener Starter)
- SB4: `spring-boot-test-autoconfigure` hat nur noch `jdbc` und `json` Test-Slices (kein `web.servlet` mehr)

## Vision Loop Bridge (2026-04-11)

- `vision-loop.spec.ts` nutzt `window.__locodoko.appStore.spieleKarte()` direkt — bypassed Keyboard-Handler
- Nach **R7** (TischSzene aufteilen): Bridge-Schnittstelle prüfen ob AppStore-Methode noch gleich heißt
- Falls Bridge bricht: `vision-loop.spec.ts` auf Tastatur-Input (`ArrowRight` + `Enter`) umstellen

## Bekannte Bugs im Spielbetrieb (2026-04-15)

- **KI hängt nach Fuchs gefangen / Hochzeit-Partner gefunden:** `NaechsterSpielerErwartet`-Event
  wird nach Sonderpunkt-Auswertung nicht getriggert oder nicht vom `KiEventAdapter` verarbeitet.
  Zu prüfen: `SpielAktionsService` nach `zieheStichEin()` → Event korrekt publiziert?
  `KiEventAdapter`-Listener registriert? Tritt reproduzierbar auf wenn Fuchs gefangen wird.

- **Schweinchen zeigt keine Wirkung:** Karo-Asse werden trotz aktivem Schweinchen nicht als
  höchste Trümpfe behandelt. `SchweinchenTrumpfOrdnung`-Aktivierung in `teileKartenAus()` prüfen.

- **Animations-Queue-Aufstauung:** Bei schnellen KI-Zügen werden plötzlich zwei Stiche
  gleichzeitig animiert. `AnimationenService` braucht serielle FIFO-Queue.

- **Browser-Reload zeigt alten State:** `Strg+R` zeigt Overlays/Animationen des vorherigen Spiels.
  AppStore + AnimationenService müssen vor Snapshot-Verarbeitung vollständig resettet werden.

- **DKV-Turnier-Preset: Spiel schließt nicht ab** — reproduzierbar mit DKV-Preset (alle
  Sonderregeln deaktiviert). Fehler in `Spiel.werteAus()` oder `PunkteRechner`.

<!-- Ralph trägt hier neue Erkenntnisse über den Build-Prozess ein. -->
