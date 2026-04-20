# Methodik: Clean Code & DDD-Prinzipien

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Aktive Vorgabe                              |
| Priorität      | Hoch                                        |
| Abhängigkeiten | architektur-ddd.md                          |

## Beschreibung

Dieses Dokument definiert die allgemeingültigen Prinzipien für die Code-Qualität, Struktur und Methodik im Locodoko-Projekt. Der Fokus liegt auf Fachlichkeit, Lesbarkeit und Wartbarkeit, unabhängig vom konkret eingesetzten Framework.

## 1. Domain-Driven Design (DDD) & Ubiquitous Language

- **Fachsprache im Code:** Alle Klassen, Methoden und Variablen im Spielkern (`partie/`, `tisch/`) MÜSSEN die deutschen Fachbegriffe des Doppelkopf-Spiels verwenden (z.B. `Stich`, `Trumpf`, `Dulle`, `Fuchs`, `Armut`, `Hochzeit`). Vermeide technische Denglisch-Mischungen wie `CardManager` oder `TrickCalculator`.
- **Rich Domain Models:** Entitäten und Aggregate sollen Verhalten (Methoden) und Zustand (Felder) kapseln. Vermeide "Anemic Domain Models" (Klassen, die nur aus Gettern/Settern bestehen). Logik gehört in die Domain-Objekte, nicht in Services, es sei denn, sie orchestriert Domain-Objekte.
- **Value Objects:** Nutze Value Objects für Konzepte ohne eigene Identität, die durch ihre Attribute definiert sind (z.B. eine `Karte` bestehend aus `Farbe` und `Wert`). Value Objects müssen **immutable** (unveränderlich) sein.

## 2. Clean Code Prinzipien

- **Kleine, fokussierte Klassen und Methoden (Single Responsibility Principle):** Eine Klasse oder Methode sollte genau einen klar definierten Zweck haben. Wenn Methoden zu lang werden (z.B. > 30 Zeilen) oder viele unterschiedliche Dinge tun, müssen sie refaktoriert werden.
- **Keine Magic Numbers / Strings:** Hardcodierte Werte (z.B. `46` für eine Solo-Schwelle, `30` für Augen-Pflicht) müssen als sprechende Konstanten (`public static final` oder Enums) extrahiert werden, damit ihr Kontext sofort verständlich ist.
- **Fail Fast & Guard Clauses:** Fehlerhafte Zustände oder ungültige Eingaben sollen so früh wie möglich durch Exceptions (z.B. `IllegalArgumentException`) abgewehrt werden. Vermeide tiefe Verschachtelungen von `if/else`-Blöcken ("Arrow Code").
- **Aussagekräftige Namen:** Wähle Namen, die die *Absicht* erklären, nicht die technische Umsetzung. Eine Liste von Karten sollte nicht `kartenList` heißen, sondern z.B. `handkarten` oder `gespielteKarten`.

## 3. Immutability & Seiteneffekte

- Bevorzuge unveränderliche Datenstrukturen. Wenn sich ein Zustand ändert, gib ein neues Objekt zurück, anstatt das bestehende zu mutieren (insbesondere bei Value Objects).
- Vermeide versteckte Seiteneffekte. Methoden, die Werte zurückgeben (Queries), sollten den Systemzustand nicht verändern. Methoden, die den Zustand verändern (Commands), sollten idealerweise `void` sein (CQS - Command Query Separation).

## 4. Test-Driven & Verifikation

- **Tests als Spezifikation:** Tests dokumentieren das erwartete Verhalten. Die Namen der Testmethoden sollten das funktionale Szenario beschreiben (z.B. `sollteFuchsPunkteAnrechnenWennKaroAsGefangenWird()`).
- **Test-Isolation:** Jeder Test muss unabhängig laufen können. Kein Test darf vom Zustand eines vorherigen Tests abhängen.

## 5. Technikunabhängigkeit

- Spezifikationen und Architekturrichtlinien beschreiben **Was** das System tun soll und **Warum**, nicht zwangsläufig das exakte **Wie** (keine Festlegung auf spezifische Zeilennummern oder private Hilfsmethoden in den Specs).
- Framework-Abhängigkeiten (z.B. Spring-Annotations oder Datenbank-Details) dürfen niemals in die reine Domain-Logik ("Core") durchsickern. Der Spielkern muss rein, framework-agnostisch und isoliert testbar bleiben.

## 6. Simple and Powerful (Spring-Philosophie)

- **Komplexität minimieren:** Wähle immer den einfachsten Weg, der das Problem vollständig löst. Vermeide Over-Engineering, unnötige Abstraktionsschichten oder verfrühte Optimierungen ("You Aren't Gonna Need It" - YAGNI).
- **Mächtige Werkzeuge gezielt einsetzen:** Nutze die Stärken des Frameworks (wie Spring Boot, Spring Modulith, Spring Data JDBC) in den äußeren Layern (Infrastruktur, API), um Standardaufgaben effizient zu lösen, ohne das Rad neu zu erfinden.
- **Konvention vor Konfiguration:** Halte dich an etablierte Standards und Konventionen des Projekts und des Frameworks, um den Code vorhersehbar und leicht verständlich zu halten.
