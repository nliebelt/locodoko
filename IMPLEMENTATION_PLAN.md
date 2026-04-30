# IMPLEMENTATION_PLAN — Plan-Run #99

> Stand: 2026-04-30. Fokus: Integrations-Lücken & Polishing (Statistiken, Security, UX).
> Archivierte Aufgaben: `IMPLEMENTATION_PLAN_ARCHIVE.md`

---

## Zusammenfassung Plan-Run #99

Nach der umfassenden Analyse des IST-Standes gegen die Specs konzentrieren wir uns auf die Schließung technischer Lücken zwischen den Bounded Contexts und die Verfeinerung der UX.
1. **Event-Kette schließen:** Das `SpielBeendet`-Event muss gefeuert werden, damit Statistiken und Profil-Updates funktionieren.
2. **Security-Härtung:** Die `SecurityConfig` wird an die Authentifizierungs-Spec angepasst.
3. **UX-Polishing:** Implementierung der 800ms KI-Verzögerung und Verbesserung der Tastatursteuerung.
4. **Stabilität:** Behebung des Reload-Problems (BUG-ANIM-03).

---

## P1 — Integration & Security

### BUG-STAT-01: Event-Kette für Statistiken schließen

**Priorität:** Hoch
**Problem:** `SpielerProfilService` lauscht auf `SpielBeendet`, aber das Event wird im `PartieLifecycleService` nie gefeuert. Statistiken bleiben leer.
**Umsetzung:**
1. `PartieLifecycleService.java`: In `uebernehmeDomainPartieAbschluss` (oder äquivalent) das `SpielBeendet`-Event via `ApplicationEventPublisher` veröffentlichen.
2. Sicherstellen, dass alle relevanten Daten (Spieler-IDs, Punkte, Sieg/Niederlage) im Event enthalten sind.
3. Verifizieren, dass `SpielerProfilService.beiSpielBeendet` reagiert.

### SEC-REFINEMENT: Security-Härtung

**Priorität:** Hoch
**Problem:** `SecurityConfig` nutzt aktuell `permitAll()` für fast alle Endpunkte, was der Spec `authentifizierung.md` widerspricht.
**Umsetzung:**
1. `SecurityConfig.java` anpassen: Authentifizierung für `/api/tisch/**` und `/api/spieler/**` (außer Login/Registrierung) erzwingen.
2. Sicherstellen, dass Gast-Sessions weiterhin korrekt via `AnonymousAuthenticationFilter` oder dedizierte Gast-Logik funktionieren.

---

## P2 — UX & UX-Logik

### FEAT-AI-DELAY: KI-Verzögerung implementieren

**Priorität:** Mittel
**Problem:** KI antwortet aktuell sofort synchron. Spec `ki-strategie.md` fordert ~800ms Verzögerung für ein "menschlicheres" Gefühl.
**Umsetzung:**
1. **Option A (Backend):** `KiOrchestrierungService` nutzt einen `ScheduledExecutorService`, um Züge zeitversetzt auszuführen.
2. **Option B (Frontend):** `TischSzene.ts` verzögert die Verarbeitung von KI-Events.
**Entscheidung:** Option A (Backend) wird bevorzugt, um die Logik zentral zu steuern.

### BUG-ANIM-03: Reload-State Stabilität

**Priorität:** Mittel
**Problem:** Bei einem Browser-Reload gehen Informationen über aktive Overlays oder laufende Animationen verloren, was zu einem inkonsistenten UI-Zustand führen kann.
**Umsetzung:**
1. `AppStore.ts` muss beim Laden des Snapshots prüfen, ob das Spiel in einer Phase ist, die ein Overlay erfordert (z.B. Rundenauswertung).
2. `TischSzene.ts` muss Overlays basierend auf dem geladenen State initialisieren, nicht nur auf Events reagieren.

---

## P3 — Specs & Polish

### SPEC-SYNC: Veraltete Spezifikationen aktualisieren

**Priorität:** Niedrig
**Umsetzung:**
1. `spieler-session.md`: Abschnitt "keine Benutzerkonten" entfernen/korrigieren.
2. `verbindungsabbruch.md` vs. `spieler-session.md`: Timeout-Verhalten (Löschen vs. KI-Übernahme) vereinheitlichen (KI-Übernahme ist Wahrheit).
3. `frontend-ui-logik.md`: Hybrid-Ansatz (Phaser für Spiel, DOM für Overlays) als offiziellen Standard festschreiben.

### FEAT-KEYBOARD-NAV: Vollständige Tastatursteuerung

**Priorität:** Niedrig
**Umsetzung:**
1. Tab-Fokus-Management in Modalen (Lobby, Tisch-Konfiguration).
2. Visueller Fokus-Indikator für alle interaktiven Elemente.

---

## Erledigte Aufgaben (Referenz aus #98)

- [x] **FEAT-ANIM-GUARD**: AnimationGuard implementiert.
- [x] **TEST-WS-CONTRACT**: STOMP-Integrationstest erfolgreich.
- [x] **TEST-E2E-FULLGAME**: Vision Loop verifiziert (Rundenauswertung existiert).
- [x] **TUNING-KI-SOLO**: Solo-Schwellenwerte angepasst.

---

## Offene Punkte (Übersicht)

| ID | Typ | Kurzbeschreibung | Priorität |
|----|-----|-----------------|-----------|
| BUG-STAT-01 | Bug | Statistiken werden nicht aktualisiert | Hoch |
| SEC-REFINEMENT| Security | SecurityConfig zu permissiv | Hoch |
| FEAT-AI-DELAY | UX | 800ms Verzögerung für KI-Züge | Mittel |
| BUG-ANIM-03 | Bug | Reload-State Konsistenz | Mittel |
| FEAT-KEYBOARD-NAV | UX | Tab-Fokus in Modalen | Niedrig |
| SPEC-SYNC | Spec | Veraltete Specs bereinigen | Niedrig |
