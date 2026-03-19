# Product Requirements Documentation (PRD)

## Projektname: Locodoko

Spezifikation für ein browser-basiertes Doppelkopf-Spiel als Einzelprojekt (Monorepo), auslieferbar als einzelnes JAR-File.

---

## 1. Ziele & Abgrenzung

### Ziele (MVP)

- Spielbares Doppelkopf-Spiel im Browser gegen KI-Gegner
- Grundlage für spätere Erweiterung (Multiplayer, Accounts, Rangliste)
- Saubere, erweiterbare Architektur (DDD, TDD)

### Explizit nicht im Scope (V1)

- Benutzerkonten / Authentifizierung (geplant für V2)
- Chat-System
- Rangliste / Ranking
- Zuschauer-Modus
- Mobile-Optimierung / Touch-Steuerung
- Deployment via Docker (Auslieferung als JAR)

---

## 2. Spielregeln

### 2.1 Regelwerk

- Basis: **Standard-Turnierdoppelkopf nach DKV-Regeln**
- Jeder Tisch kann Regeln individuell aktivieren oder deaktivieren (Tischkonfiguration)
- Beispiel einer abschaltbaren Regel: Spiel ohne „Neunen" (Neunen aus dem Blatt entfernen)

### 2.2 Kartendeck

- **Französisches Blatt** (♠ ♥ ♦ ♣)
- Standard: 48 Karten (24 Kartenpaare), optional 40 Karten ohne Neunen

### 2.3 Trumpfhierarchie (Standard)

Folgende Reihenfolge gilt im Standardspiel (absteigend):

1. Kreuz-Dame, Pik-Dame, Herz-Dame, Karo-Dame
2. Kreuz-Bube, Pik-Bube, Herz-Bube, Karo-Bube
3. Karo-As, Karo-Zehn, Karo-König, Karo-Neun (falls gespielt)
4. Herz-Zehn (Dulle) — zweimal vorhanden; die zweite Dulle sticht die erste (konfigurierbar)

### 2.4 Sonderspiele

Folgende Sonderspiele müssen unterstützt werden (jeweils aktivierbar/deaktivierbar):

| Sonderspiel     | Beschreibung |
|-----------------|--------------|
| **Hochzeit**    | Spieler mit beiden Kreuz-Damen bietet Partnerschaft an; erster Spieler der einen Stich gewinnt wird Partner |
| **Armut**       | Spieler mit ≤3 Trümpfen kann Karten tauschen; ein anderer Spieler nimmt die Armutskarten auf und gibt Karten zurück |
| **Damensolo**   | Nur Damen sind Trumpf |
| **Bubensolo**   | Nur Buben sind Trumpf |
| **Fleischlos**  | Kein Trumpf; Farbe bricht nicht |
| **Trumpfsolo**  | Alle Trümpfe gelten, kein Partner |

### 2.5 Ansagen

- **Re** (Re-Partei) und **Kontra** (Kontra-Partei) möglich
- Weitere Ansagen: **Keine 90**, **Keine 60**, **Keine 30**, **Schwarz**
- Ansagen sind nur in den ersten Zügen möglich (konfigurierbar: nach Kartenanzahl auf der Hand)

### 2.6 Sonderpunkte

Folgende Sonderpunkte müssen berücksichtigt werden:

| Sonderpunkt         | Beschreibung |
|---------------------|--------------|
| **Fuchs gefangen**  | Karo-As (Fuchs) der Gegenpartei gewonnen |
| **Karlchen**        | Letzter Stich mit Kreuz-Bube gewonnen |
| **Doppelkopf**      | Stich mit Wert ≥ 40 Augen gewonnen |

---

## 3. Spieler & Spielmodi

### 3.1 Spieler-Identifikation (V1)

- Kein Benutzerkonto erforderlich
- Spieler gibt beim Beitreten einen Namen ein
- Identifikation erfolgt über Session-Cookie (serverseitig gehalten)

### 3.2 Spielmodi

- **Einzelspielermodus**: 1 menschlicher Spieler + 3 KI-Spieler
- **Mehrere parallele Spiele**: Das System unterstützt mehrere gleichzeitig laufende Spielsitzungen

### 3.3 Lobby

- Übersichtsseite zeigt offene Tische
- Spieler kann neuen Tisch erstellen oder einem bestehenden beitreten
- Tischersteller konfiguriert Tischregeln (Regelwerk, Rundenanzahl etc.)

### 3.4 KI-Spieler

- KI-Spieler implementieren eine regelbasierte Strategie (keine zufälligen Züge)
- Strategieanforderungen:
  - Trumpfmanagement (Trümpfe gezielt einsetzen)
  - Partnerunterstützung (Partner-Stiche abgeben)
  - Ansagen basierend auf Handstärke
  - Sonderpunkt-Bewusstsein (Fuchs schützen/fangen)

### 3.5 Verbindungsabbrüche

- Bei Verbindungsverlust eines menschlichen Spielers wird auf Reconnect gewartet
- Timeout konfigurierbar; nach Ablauf übernimmt die KI den Spieler

---

## 4. Spielablauf

### 4.1 Rundenstruktur

- Eine **Partie** besteht aus mehreren **Spielen**
- Anzahl der Spiele pro Partie ist konfigurierbar (Standard: 24 Spiele, DKV-Empfehlung)
- Ein **Gesamtpunktestand** wird über die gesamte Partie geführt

### 4.2 Kartenverteilung

- Karten werden automatisch gemischt und verteilt
- Der **Geber** rotiert nach jedem Spiel automatisch (im Uhrzeigersinn)

### 4.3 Spielablauf je Spiel

1. Karten austeilen
2. Sonderspiel-Ansage-Phase (Hochzeit, Armut, Solo)
3. Stichphase (12 bzw. 10 Stiche bei Spiel ohne Neunen)
4. Auswertung: Augen zählen, Sonderpunkte berechnen, Spielpunkte vergeben
5. Gesamtstand aktualisieren

---

## 5. Frontend

### 5.1 Technologie

- **TypeScript** mit **Phaser Framework**
- Kompilierung zu statischen Assets, eingebettet ins Spring-Boot-JAR (via Maven/Gradle Resource-Plugin), alternativ separates npm-Projekt für Entwicklung/Tests

### 5.2 Ansicht

- **Tischperspektive von oben** (Top-Down)
- Spieler sitzt unten (Süd), KI-Spieler an den anderen Positionen (West, Nord, Ost)
- Kartenfächer des eigenen Spielers vollständig sichtbar; gegnerische Karten verdeckt

### 5.3 Hintergrund

- Konfigurierbares Hintergrundbild (über Tischeinstellungen wählbar)
- Standard-Fallback: einfache Tischansicht (grüner Filz oder ähnliches)

### 5.4 Animationen

Folgende Animationen sollen Teil der Spezifikation sein:

| Animation                | Beschreibung |
|--------------------------|--------------|
| **Karte ausspielen**     | Karte gleitet vom Spieler-Fächer zur Tischmitte |
| **Stich einziehen**      | Alle 4 Karten fliegen gebündelt zum Stich-Gewinner |
| **Karten austeilen**     | Karten werden einer nach der anderen auf die Positionen verteilt |
| **Ansage-Animation**     | Re/Kontra-Banner erscheint kurz am Bildschirm |
| **Rundenende**           | Punkteübersicht einblenden mit Aufschlüsselung |
| **Sonderpunkt-Anzeige**  | Kurzes Aufleuchten/Icon bei Fuchs, Karlchen, Doppelkopf |

### 5.5 UI-Logik

- Nur spielbare Karten sind anklickbar (basierend auf Backend-Regeln: Farbzwang, Trumpfzwang)
- Ansage-Buttons erscheinen nur, wenn eine Ansage regelkonform möglich ist
- Spectator-Ansicht für verdeckte Karten bei KI (Debug-Modus: aufdeckbar)

---

## 6. Backend

### 6.1 Technologie

- **Java** mit **Spring Boot**
- **Spring Data JPA** mit **PostgreSQL** als Datenbank
- **Spring Statemachine** für den Spielstatus
- **Spring WebSocket** mit **STOMP**-Protokoll für Echtzeit-Kommunikation
- **REST-API** für nicht-echtzeit-kritische Operationen (Lobby, Tischkonfiguration, Spielhistorie)

### 6.2 Architektur

- **Domain-Driven Design (DDD)** mit Bounded Contexts
- **Ubiquitous Language auf Deutsch** (Domänenklassen, Methoden und Variablen in deutscher Sprache)
- **Test-Driven Development (TDD)** — alle Domänenlogik muss mit Unit-Tests abgedeckt sein
- Das Backend ist die **einzige Wahrheitsquelle**; jeder Spielzug wird serverseitig validiert

### 6.3 Bounded Contexts (vorläufig)

| Context              | Verantwortlichkeit |
|----------------------|--------------------|
| **Spielverwaltung**  | Tisch, Partie, Rundensteuerung |
| **Spielregeln**      | Regelkonfiguration, Gültigkeitsprüfung von Zügen |
| **Kartenverwaltung** | Kartendeck, Austeilen, Stichbewertung |
| **KI-Strategie**     | Entscheidungslogik für KI-Spieler |
| **Kommunikation**    | WebSocket-Events, REST-Endpunkte |
| **Punkteberechnung** | Augen, Sonderpunkte, Spielpunkte, Gesamtstand |

### 6.4 Spring Statemachine — Spielzustände (vorläufig)

```
WARTEN_AUF_SPIELER
  → SONDERSPIEL_ANSAGE
    → ARMUT_TAUSCH
  → STICH_PHASE
    → NAECHSTER_STICH
  → SPIELENDE
    → NAECHSTES_SPIEL
  → PARTIEENDE
```

### 6.5 WebSocket-Events (STOMP, vorläufig)

| Event                    | Richtung           | Beschreibung |
|--------------------------|--------------------|--------------|
| `KarteGespielt`          | Client → Server    | Spieler spielt eine Karte aus |
| `SpielbrettAktualisiert` | Server → Client    | Neuer Spielzustand nach Zug |
| `StichGewonnen`          | Server → Client    | Stich-Gewinner & Karten |
| `AnsageGetaetigt`        | Client → Server    | Re/Kontra o.ä. angesagt |
| `SonderspielAngemeldet`  | Client → Server    | Solo, Hochzeit, Armut angemeldet |
| `ArmutKartenAngeboten`   | Server ↔ Client    | Kartentausch bei Armut |
| `SpielGestartet`         | Server → Client    | Spiel beginnt, Karten verteilt |
| `SpielBeendet`           | Server → Client    | Auswertung & Punkte |
| `PartieBeendet`          | Server → Client    | Gesamtauswertung |
| `FehlerAufgetreten`      | Server → Client    | Ungültiger Zug oder Serverfehler |

### 6.6 REST-API (vorläufig)

| Methode | Endpunkt                       | Beschreibung |
|---------|--------------------------------|--------------|
| `GET`   | `/api/tische`                  | Alle offenen Tische abrufen |
| `POST`  | `/api/tische`                  | Neuen Tisch erstellen |
| `POST`  | `/api/tische/{id}/beitreten`   | Tisch beitreten |
| `GET`   | `/api/tische/{id}/konfiguration` | Tischregeln abrufen |
| `PUT`   | `/api/tische/{id}/konfiguration` | Tischregeln anpassen |
| `GET`   | `/api/partien/{id}/stand`      | Aktuellen Punktestand abrufen |

---

## 7. Datenbankmodell (konzeptionell)

| Entität            | Wichtige Felder |
|--------------------|-----------------|
| `Tisch`            | id, name, konfiguration, status |
| `Partie`           | id, tischId, anzahlSpiele, gesamtstand |
| `Spiel`            | id, partieId, geber, spieltyp, ergebnis |
| `Spieler`          | id, name, sessionId, istKI |
| `Hand`             | spielerId, spielId, karten |
| `Stich`            | spielId, nummer, karten, gewinner |
| `Tischkonfiguration` | regelSet, ohneNeunen, sonderspieleAktiv, ansagenErlaubt |

---

## 8. Auslieferung & Build

- Auslieferung als **einzelnes ausführbares JAR-File**
- Frontend-Assets (kompiliertes TypeScript/Phaser) werden in `src/main/resources/static` eingebettet
- Für Entwicklung und Tests kann das Frontend als **separates npm-Projekt** laufen
- Build-Tool: **Maven** (oder Gradle, noch zu entscheiden)
- Datenbank: **PostgreSQL** (lokal via Konfigurationsdatei konfigurierbar)

---

## 9. Nicht-funktionale Anforderungen

- Spielzug-Validierung serverseitig < 100ms
- WebSocket-Latenz für Event-Zustellung < 200ms (lokal)
- Alle Domänenklassen mit Unit-Tests abgedeckt (TDD)
- Codebasis dokumentiert auf Englisch (Kommentare), Domänensprache auf Deutsch
