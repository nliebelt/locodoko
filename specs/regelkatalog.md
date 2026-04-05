# Regelkatalog (Regel-Presets)

| Feld           | Wert                                                              |
|----------------|-------------------------------------------------------------------|
| Status         | Spezifiziert, nicht implementiert                                 |
| Priorität      | Mittel                                                            |
| Abhängigkeiten | tischkonfiguration.md, bockrunden.md, schweinchen.md, dreissig-augen-pflicht.md |

## Beschreibung

Der Regelkatalog definiert **benannte Regelsets**, die bei der Tisch-Erstellung als Preset
gewählt werden können. Statt jede Option einzeln einzustellen, wählt der Gastgeber ein
Preset aus, das alle Felder der `Spielregeln` vorbelegt. Einzelne Optionen können danach
im „Benutzerdefiniert"-Modus überschrieben werden.

## Presets

### Loco Blatt (Standard)

Das Hausregelset von Locodoko — vollständiges Spiel mit allen modernen Sonderregeln.

| Option | Wert |
| ------ | ---- |
| `ohneNeunen` | false |
| `zweiteDulleSticht` | true |
| `bockrundenAktiv` | true |
| `schweinchenAktiv` | true |
| `dreissigAugenPflichtAktiv` | true |
| `fuchsAktiv` | true |
| `karlchenAktiv` | true |
| `doppelkopfAktiv` | true |
| `armutAktiv` | true |
| `hochzeitAktiv` | true |
| `soloDameAktiv` | true |
| `soloBubeAktiv` | true |
| `soloTrumpfAktiv` | true |
| `soloFleischlosAktiv` | true |
| `anzahlSpiele` | 24 |

### DKV-Turnier

Offizielles DKV-Regelwerk (Deutscher Doppelkopf-Verband), ohne Locodoko-Hausregeln.

| Option | Wert |
| ------ | ---- |
| `ohneNeunen` | false |
| `zweiteDulleSticht` | true |
| `bockrundenAktiv` | false |
| `schweinchenAktiv` | false |
| `dreissigAugenPflichtAktiv` | false |
| `fuchsAktiv` | true |
| `karlchenAktiv` | true |
| `doppelkopfAktiv` | true |
| `armutAktiv` | true |
| `hochzeitAktiv` | true |
| `soloDameAktiv` | true |
| `soloBubeAktiv` | true |
| `soloTrumpfAktiv` | true |
| `soloFleischlosAktiv` | true |
| `anzahlSpiele` | 24 |

### Ohne Neunen

Schnellvariante mit 40 statt 48 Karten, sonst wie Loco Blatt.

| Option | Wert |
| ------ | ---- |
| `ohneNeunen` | true |
| alle anderen | wie Loco Blatt |

### Benutzerdefiniert

Kein Preset — alle Optionen werden individuell vom Gastgeber konfiguriert.

## Anforderungen

1. Die UI bietet bei der Tisch-Erstellung eine **Preset-Auswahl** an
   (Loco Blatt / DKV-Turnier / Ohne Neunen / Benutzerdefiniert).
2. Nach Wahl eines Presets werden alle Felder des Konfigurations-Modals
   **automatisch vorbelegt**.
3. Bei Wahl von „Benutzerdefiniert" werden alle Einzeloptionen editierbar dargestellt.
4. Bei den anderen Presets sind Einzeloptionen **schreibgeschützt sichtbar** (keine
   Überraschungen), aber nicht editierbar — außer der Nutzer wechselt auf
   „Benutzerdefiniert".
5. Das gewählte Preset wird **nicht persistent** gespeichert — nur die resultierenden
   `Spielregeln`-Werte werden an das Backend übergeben.
6. `Spielregeln.locoBlatRegeln()` und `Spielregeln.dkvRegeln()` als statische
   Factory-Methoden im Backend.

## Akzeptanzkriterien

- Preset-Auswahl vorbelegt mit „Loco Blatt".
- Preset-Wechsel überschreibt alle Felder korrekt.
- „Benutzerdefiniert" schaltet alle Felder frei.
- `locoBlatRegeln()` und `dkvRegeln()` liefern die oben definierten Werte.

## Definition of Done

- [ ] `Spielregeln.locoBlatRegeln()` implementiert
- [ ] `Spielregeln.dkvRegeln()` implementiert
- [ ] `Spielregeln.ohneNeunenLocoBlatRegeln()` implementiert
- [ ] Frontend: Preset-Dropdown im Tisch-Konfigurations-Modal
- [ ] Frontend: Vorbelegen aller Felder bei Preset-Wechsel
- [ ] Frontend: „Benutzerdefiniert"-Modus schaltet alle Felder frei
- [ ] Unit-Tests für alle Factory-Methoden

## Technische Hinweise

- **Bounded Context**: Spielregeln / Lobby / Frontend
- Backend: `Spielregeln` erhält drei neue Factory-Methoden; die vorhandene
  `standardRegeln()` kann auf `locoBlatRegeln()` delegieren oder als Alias bestehen bleiben.
- Frontend: Preset-Objekte als TypeScript-Konstanten in `regelPresets.ts`;
  bei Auswahl werden die Werte ins Formular geschrieben. Das Backend kennt kein Preset-Konzept —
  es empfängt immer nur die flachen `Spielregeln`-Werte.
