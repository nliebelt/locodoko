# Frontend: Spieler-Profil

| Feld           | Wert                                                              |
|----------------|-------------------------------------------------------------------|
| Status         | Geplant — FE-1 (Task 77) + FE-2 (Task 78), Plan-Run 2026-05-22   |
| Priorität      | Mittel                                                            |
| Abhängigkeiten | spieler-profil.md, frontend-architektur.md, frontend-visuelles-design.md |
| Vorbedingung   | DB-9 (Task 75) — `SpielerProfilAntwort` mit Multi-Variante-Statistiken |

## Beschreibung

Neues Feature: Spieler können ihr eigenes Profil aus der Lobby öffnen und sehen
Statistiken (pro Regelvariante), Sonderpunkt-Bilanz und Partie-Historie.

Backend liefert bereits `/api/spieler/{id}/profil` — nur das Frontend fehlt.

---

## Layout-Konzept

Das Profil wird als **HTML-Modal** gezeigt (konsistent mit Einstellungs-Modal-Pattern).
Neo-Brutalism-Style gemäß `frontend-visuelles-design.md`.

```
┌─────────────────────────────────────────────────────┐
│  ● [Avatar]  Max Mustermann                    [✕]  │
│              Mitglied seit 2026-01-15               │
├─────────────────────────────────────────────────────┤
│  [TURNIER]  [SONDER]  [FREI]                        │  ← Tab-Leiste
├─────────────────────────────────────────────────────┤
│  STATISTIKEN                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  42 Sp.  │ │ 28 Siege │ │  67%     │            │
│  │ Gespielt │ │          │ │ Win-Rate │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
│  RE / KONTRA                                        │
│  Re:     18 Siege / 5 Niederlagen  (78%)            │
│  Kontra: 10 Siege / 9 Niederlagen  (53%)            │
│                                                     │
│  SONDERPUNKTE                                       │
│  🦊 Fuchs gefangen: 12  |  Fuchs verloren: 4        │
│  👑 Karlchen: 3  |  Doppelköpfe: 7  |  Schweinchen: 1│
│                                                     │
│  SOLOS                                              │
│  Damensolo: 3/1 | Bubensolo: 1/0 | ...             │
│  Hochzeiten: 2  |  Armuten: 1                       │
├─────────────────────────────────────────────────────┤
│  LETZTE PARTIEN                                     │
│  2026-05-20  Tisch "Alpha"   2. Platz  +3 Pkt  10S │
│  2026-05-18  Tisch "Beta"    1. Platz  +8 Pkt  12S │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

---

## Datenfluss

```
SpielerProfilSzene / SpielerProfilModal
  │
  └─▶ SpielverwaltungApi.ladeSpielerProfil(spielerId)
        GET /api/spieler/{id}/profil
        → SpielerProfilAntwort {
            anzeigeName, avatarFarbe, erstelltAm,
            statistiken: Map<Regelvariante, SpielerStatistikDto>,
            partieVerlauf: PartieErgebnisEintrag[]
          }
```

---

## Implementierungs-Details (FE-1, Task 77)

1. **Öffnen:** Button „Mein Profil" im Lobby-Screen oder Klick auf eigenen Spielernamen.
2. **Komponente:** `frontend/src/ui/SpielerProfilModal.ts` (HTML-Modal-Pattern).
3. **API-Methode:** `SpielverwaltungApi.ladeSpielerProfil(spielerId: Uuid): Promise<SpielerProfilAntwort>`.
4. **Typen:** `SpielerProfilAntwort` aus `generated/api-types.ts` (nach `npm run generate-types`).
5. **Tab-Wechsel:** Je Tab eine `SpielerStatistikDto`-Instanz anzeigen.
6. **Leer-Zustand:** Falls keine Statistik für eine Variante vorhanden, Hinweis „Noch keine Partien".

---

## Implementierungs-Details (FE-2, Task 78)

1. **Partie-Historie:** Scrollbare Liste in separatem Abschnitt des Modals.
2. **Backend-Endpunkt:** Nutzt `partie_ergebnis_view` (DB-10, Task 76). Kein Limit.
3. **Darstellung pro Zeile:** Datum | Tisch-Name | Rangplatz | Endpunktestand | Spielanzahl.
4. **Optional V2:** Klick auf eine Partie → Detail-Ansicht mit Spiel-für-Spiel-Aufstellung.

---

## Definition of Done

- [ ] Modal öffnet sich aus Lobby-Screen
- [ ] Statistiken pro Regelvariante werden korrekt angezeigt (Tab-Wechsel)
- [ ] Re/Kontra-Bilanz mit Win-Rate sichtbar
- [ ] Sonderpunkt-Bilanz sichtbar (Fuchs, Karlchen, Doppelköpfe, Schweinchen)
- [ ] Solo-Bilanz pro Solo-Typ aus `solos_pro_typ`-JSONB
- [ ] Partie-Historie scrollbar, korrekte Daten aus VIEW
- [ ] Leer-Zustand (keine Partien) korrekt dargestellt
- [ ] Unit-Test mit Mock-API-Antwort
- [ ] `specs/spieler-profil.md` DoD-Häkchen Z. 80 nach Abschluss von FE-1+FE-2 gesetzt
- [ ] Neo-Brutalism-Style konsistent mit restlichem UI
