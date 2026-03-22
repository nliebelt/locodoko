# Tischkonfiguration

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Vollständig implementiert und getestet      |
| Priorität      | Mittel                                      |
| Abhängigkeiten | lobby.md                                    |

## Beschreibung

Die Tischkonfiguration definiert das Regelwerk, das an einem bestimmten Tisch gilt. Jeder Tisch kann individuell konfiguriert werden, um verschiedene Doppelkopf-Varianten zu ermöglichen. Die Konfiguration wird beim Erstellen des Tischs festgelegt und kann vor Spielbeginn angepasst werden.

## Anforderungen

1. Jeder Tisch hat eine eigene **Tischkonfiguration**.
2. Die Konfiguration wird beim **Erstellen des Tischs** festgelegt.
3. Die Konfiguration kann **vor Spielbeginn** durch den Tischersteller angepasst werden.
4. **Während eines laufenden Spiels** kann die Konfiguration **nicht** geändert werden.
5. Folgende Optionen sind konfigurierbar:

   | Option                       | Typ     | Standard          | Beschreibung |
   |------------------------------|---------|-------------------|--------------|
   | `ohneNeunen`                 | boolean | false             | Spiel ohne Neunen (40 statt 48 Karten) |
   | `anzahlSpiele`               | int     | 24                | Anzahl Spiele pro Partie |
   | `hochzeitErlaubt`            | boolean | true              | Hochzeit als Sonderspiel zulassen |
   | `armutErlaubt`               | boolean | true              | Armut als Sonderspiel zulassen |
   | `damensoloErlaubt`           | boolean | true              | Damensolo zulassen |
   | `bubensoloErlaubt`           | boolean | true              | Bubensolo zulassen |
   | `fleischlosErlaubt`          | boolean | true              | Fleischlos zulassen |
   | `trumpfsoloErlaubt`          | boolean | true              | Trumpfsolo zulassen |
   | `zweiteDulleSticht`          | boolean | true              | Zweite Dulle sticht die erste |
   | `fuchsGefangenAktiv`         | boolean | true              | Sonderpunkt „Fuchs gefangen" aktiv |
   | `karlchenAktiv`              | boolean | true              | Sonderpunkt „Karlchen" aktiv |
   | `doppelkopfAktiv`            | boolean | true              | Sonderpunkt „Doppelkopf" aktiv |
   | `ansageGrenzen`              | Map     | {re: 11, k90: 10, k60: 9, k30: 8, schwarz: 7} | Mindestkartenanzahl für Ansagen |

6. Es gibt eine **Standard-Konfiguration** (DKV-Turniermodus), die als Default verwendet wird.
7. Die Konfiguration muss **validiert** werden (z.B. Anzahl Spiele > 0).

## Akzeptanzkriterien

- Eine neue Tischkonfiguration wird mit sinnvollen Standardwerten erstellt.
- Alle konfigurierbaren Optionen können geändert werden.
- Ungültige Konfigurationen werden abgelehnt (z.B. Anzahl Spiele = 0).
- Die Konfiguration kann vor Spielbeginn angepasst werden.
- Die Konfiguration kann während eines laufenden Spiels nicht geändert werden.
- Die aktuelle Tischkonfiguration kann per REST-API abgerufen werden.
- Deaktivierte Sonderspiele können in der Vorbehalt-Phase nicht angemeldet werden.
- Deaktivierte Sonderpunkte werden nicht gewertet.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für Konfigurationsvalidierung geschrieben und bestanden
- [x] REST-API-Endpunkte für Konfiguration implementiert und getestet
- [x] Integration mit Spiellogik getestet (aktivierte/deaktivierte Regeln)
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielverwaltung / Spielregeln
- REST-API Endpunkte:
  - `GET /api/tische/{id}/konfiguration` — Konfiguration abrufen
  - `PUT /api/tische/{id}/konfiguration` — Konfiguration anpassen
- `Tischkonfiguration` als **Value Object** oder **Embeddable** modellieren
- Die Spiellogik (Sonderspiele, Ansagen, Sonderpunkte) prüft die Konfiguration per Dependency Injection
- Validierung über Bean-Validation-Annotationen oder eigene Validierungslogik
