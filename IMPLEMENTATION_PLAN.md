# IMPLEMENTATION_PLAN

Stand: 2026-03-20

Ausgangslage: Das Repository enthaelt jetzt ein baubares technisches Grundgeruest fuer Backend und Frontend. Das Backend laeuft als Spring-Boot-Anwendung mit H2-Entwicklungsprofil und vorbereitetem Produktionsprofil; das Frontend liegt als TypeScript-/Phaser-/Vite-Projekt vor und wird fuer Packaging nach `src/main/resources/static/app` eingebettet. Der naechste Schwerpunkt ist damit klar der fachliche Domainenkern fuer Karten, Trumpf und Stichlogik.

## Erledigt / vorhanden

- [x] Produktziel und MVP-Rahmen in `PRD.md` beschrieben.
- [x] Fachspezifikationen in `specs/` liegen fuer die Kernbereiche vor: Kartendeck, Trumpfhierarchie, Stichlogik, Spielablauf, Ansagen, Punkteberechnung, Sonderpunkte, Lobby, REST-API, WebSocket-Kommunikation, Session, KI, Tischkonfiguration, Frontend-Tischansicht, Frontend-UI-Logik, Animationen, Sonderspiele.
- [x] Lokale Arbeitsumgebung fuer Java 21, Maven, Node.js und Chromium ist ueber `Dockerfile` und `docker-compose.yml` beschrieben.
- [x] Planungsgrundlage ist vollstaendig genug, um mit der Implementierung zu beginnen; zusaetzliche Spezifikationsdateien sind nach heutigem Stand nicht noetig.
- [x] Maven-Spring-Boot-Projekt mit `pom.xml`, `src/main/java`, `src/test/java`, `src/main/resources` und erstem Systemstatus-Endpunkt angelegt.
- [x] Frontend-Projekt unter `frontend/` mit TypeScript, Phaser, Vite, Vitest und ESLint angelegt.
- [x] Packaging eingerichtet: `mvn clean verify` fuehrt `npm ci` und `npm run build:embed` aus und bettet das Frontend nach `src/main/resources/static/app` ein.
- [x] Qualitaetssicherung laeuft fuer Grundgeruest: `mvn test`, `cd frontend && npm test`, `cd frontend && npm run lint`, `cd frontend && npm run build`, `mvn clean verify`.
- [x] Entwicklungsprofil mit H2 und vorbereitetes Produktionsprofil fuer PostgreSQL sind konfiguriert.
- [x] Basis-Tests sichern WARUM das Grundgeruest wichtig ist: Backend-Test prueft Startfaehigkeit und API-Erreichbarkeit frueh, Frontend-Test fixiert die Sitzordnung/Normalspiel-Handgroesse als Fundament fuer die spaetere Tischansicht.
- [x] Domainenkern fuer Karten und Regeln liegt jetzt in `src/main/java/de/locodoko/spiel/karten`: Farben, Werte, Karten, Spieltypen, Spielerpositionen, Haende, Deck-Erzeugung mit/ohne Neunen, austauschbare Trumpfstrategie und Stichlogik inklusive Spielzug-Validierung.
- [x] Neue Backend-Tests sichern WARUM dieser Kern wichtig ist: Sie fixieren Deckgroesse und 240-Augen-Invariante, pruefen Trumpfhierarchie und Dullen-Sonderfall und erzwingen Bedienpflicht sowie Gewinnerermittlung als serverseitige Wahrheitsquelle fuer KI, UI und Wertung.
- [x] Vertikaler Slice fuer ein Normalspiel ohne Sonderspiele liegt jetzt in `src/main/java/de/locodoko/spiel/partie`: Tisch, Partie, Spiel, Parteien, explizite Spielphasen, Geberrotation, erster Aufspieler, Grundauswertung und Gesamtstand fuer mehrere Spiele.
- [x] Neue Backend-Tests sichern WARUM dieser Slice wichtig ist: Sie pruefen den kompletten Phasenlauf eines Normalspiels, verdeckte Parteiinformation, ungueltige Zustandsuebergaenge sowie Geberrotation und Nullsummen-Gesamtstand ueber mehrere Spiele.
- [x] Ansagen, Punkteberechnung und Sonderpunkte fuer den Normalspiel-Slice liegen jetzt in `src/main/java/de/locodoko/spiel/partie`: Grundansagen und Absagen waehrend der Stichphase, konfigurierbare Ansagefenster in `Spielregeln`, Sonderpunktbewertung fuer Fuchs/Karlchen/Doppelkopf und eine Endauswertung, die Ansagen, Sonderpunkte und Nullsummen-Verteilung zusammenfuehrt.
- [x] Neue Backend-Tests sichern WARUM dieser Ausbau wichtig ist: Sie fixieren Ansagereihenfolge und Zeitfenster, pruefen Sonderpunkte getrennt von der Stichlogik und belegen, dass die Spielwertung trotz Ansagen und Sonderpunkten stabil 240 Augen und eine Nullsumme fuer den Gesamtstand behaelt.
- [x] Die Vorbehaltsphase kann jetzt neben `gesund` auch `Trumpfsolo` verarbeiten: Vorbehaltsmeldungen werden in Sitzreihenfolge gespeichert, deaktivierbare Trumpfsoli serverseitig validiert, bei mehreren Soli entscheidet die fruehere Sitzposition, und die Solo-Parteien sind von Beginn an offen.
- [x] Neue Backend-Tests sichern WARUM dieser Schritt wichtig ist: Sie fixieren die Vorbehaltsaufloesung fuer `Trumpfsolo`, pruefen die offene 1-gegen-3-Parteibildung und verhindern, dass deaktivierte Sonderspiele spaeter durch UI oder API versehentlich doch gestartet werden.

## Offen - Prioritaet 0: Projektgrundgeruest und Build-Pipeline

- [x] Maven-Spring-Boot-Projekt anlegen (`pom.xml`, `src/main/java`, `src/test/java`, `src/main/resources`) und Build so aufsetzen, dass das Backend lokal baubar und testbar ist.
- [x] Frontend-Projekt unter `frontend/` anlegen (`package.json`, TypeScript, Phaser, Test-Setup, Lint-Setup, Build-Skript).
- [x] Packaging festlegen, damit gebaute Frontend-Assets nach `src/main/resources/static` uebernommen und spaeter in ein einzelnes JAR eingebettet werden.
- [x] Grundlegende Qualitaetssicherung einrichten: Backend-Testlauf, Frontend-Testlauf, Frontend-Lint, Frontend-Build, `mvn clean verify`.
- [x] Basis-Konfiguration fuer Entwicklungsprofil mit H2 vorbereiten; Produktionsprofil fuer spaetere PostgreSQL-Nutzung anschlussfaehig halten.

## Offen - Prioritaet 1: Domainenkern fuer Karten und Regeln

- [x] Domainenmodell fuer Karten, Farben, Werte, Trumpf, Spieltypen, Spielerpositionen und Haende anlegen gemaess `specs/kartendeck.md` und `specs/trumpfhierarchie.md`.
- [x] Kartenstapel mit Mischen und Austeilen fuer 48 Karten sowie die Variante ohne Neunen implementieren.
- [x] Trumpf- und Ranglogik fuer Normalspiel sowie Solo-Varianten kapseln, damit dieselbe Bewertungslogik spaeter in Stichlogik, UI-Sortierung und KI wiederverwendet werden kann.
- [x] Stichmodell und Spielzug-Validierung gemaess `specs/stichlogik.md` implementieren: angefragte Farbe, Bedienpflicht, gueltige Karten, Gewinnerermittlung, Augenberechnung, Reihenfolge im Uhrzeigersinn.
- [x] Unit-Tests fuer Kartenverteilung, Trumpfordnung, Bedienpflicht und Stichgewinner vorziehen; das ist die kritische Grundlage fuer alle weiteren Pakete.

## Offen - Prioritaet 2: Spielablauf, Zustandsmaschine und Parteien

- [x] Aggregates und Services fuer Tisch, Partie, Spiel und Stichfolge fuer den Normalspiel-Slice modellieren.
- [x] Spielphasen aus `specs/spielablauf.md` fuer den Normalspiel-Pfad als explizite Zustandslogik umsetzen: Austeilen, Vorbehalt-Ansage, Vorbehalt-Aufloesung, Stichphase, Auswertung, Gesamtstand; optionale Sonderpfade bleiben in Prioritaet 4.
- [x] Geberrotation, erster Aufspieler, Spielanzahl pro Partie und Gesamtpunktestand implementieren.
- [x] Parteibildung fuer Normalspiel (Kreuz-Damen -> Re) inklusive anfangs verdeckter Information abbilden.
- [x] Fehlerfaelle fuer ungueltige Zustandsuebergaenge und ungueltige Aktionen sauber modellieren und testen.

## Offen - Prioritaet 3: Wertung, Ansagen und Sonderpunkte

- [x] Ansagen gemaess `specs/ansagen.md` implementieren: Re, Kontra, Keine 90, Keine 60, Keine 30, Schwarz inklusive erlaubter Zeitfenster.
- [x] Punkte- und Ergebnislogik gemaess `specs/punkteberechnung.md` implementieren: Augen zaehlen, Gewinner bestimmen, Spielpunkte ableiten, Nullsummenpruefung.
- [x] Sonderpunkte gemaess `specs/sonderpunkte.md` integrieren: Fuchs, Karlchen, Doppelkopf.
- [x] Fachliche Abhaengigkeiten zwischen Stichhistorie, Ansagen und Endauswertung in Integrationstests absichern.

## Offen - Prioritaet 4: Sonderspiele fuer MVP und danach

- [ ] Vorbehalt-Logik mit Priorisierung Solo > Hochzeit > Armut fertigstellen; die Infrastruktur fuer echte Vorbehaltsmeldungen und `Trumpfsolo` liegt jetzt, Hochzeit und Armut fehlen noch.
- [ ] Hochzeit gemaess `specs/hochzeit.md` implementieren, inklusive Partnerfindung ueber den ersten gewonnenen Stich.
- [ ] Armut gemaess `specs/armut.md` implementieren, inklusive Angebot, Annahme und Kartentausch.
- [ ] Solo-Varianten in sinnvoller Reihenfolge umsetzen: `solo-dame.md` und `solo-bube.md` nachziehen, danach `solo-fleischlos.md`; `solo-trumpf.md` ist umgesetzt.
- [ ] Pro Sonderspiel gezielte Unit- und Integrationsfaelle aufbauen, weil diese Regeln tief in Trumpf- und Parteilogik eingreifen.

## Offen - Prioritaet 5: Persistenz, Session, Lobby und Schnittstellen

- [ ] JPA-Entitaeten und Repositories gemaess `specs/datenbankmodell.md` anlegen, zunaechst H2-tauglich und spaeter PostgreSQL-kompatibel.
- [ ] Session-basierte Spieleridentifikation gemaess `specs/spieler-session.md` umsetzen.
- [ ] REST-API gemaess `specs/rest-api.md` bereitstellen: Tische listen/anlegen/beitreten, Konfiguration lesen/aendern, Spielstand abrufen.
- [ ] Lobby-Domaene und Tischverwaltung gemaess `specs/lobby.md` implementieren, inklusive Begrenzung auf einen Tisch pro Spieler und KI-Auffuellen beim Start.
- [ ] WebSocket/STOMP-Kommunikation gemaess `specs/websocket-kommunikation.md` anbinden, damit Lobby- und Spielzustand in Echtzeit publiziert werden.

## Offen - Prioritaet 6: Spielbares Frontend

- [ ] Frontend-Grundgeruest mit Routing/Scene-Struktur, Asset-Loading und Verbindung zum Backend aufbauen.
- [ ] Lobby-Ansicht zum Erstellen, Beitreten und Starten von Tischen implementieren.
- [ ] Tischansicht gemaess `specs/frontend-tischansicht.md` umsetzen: Top-Down-Tisch, Spielerpositionen, eigene/offene Karten, gegnerische/verdeckte Karten, Stichmitte, Statusanzeigen.
- [ ] UI-Logik gemaess `specs/frontend-ui-logik.md` umsetzen: nur gueltige Karten anklickbar, Ansage-Buttons phasenabhaengig, Vorbehalt-Dialoge, Punktestand, Debug-Modus.
- [ ] Frontend an REST/WebSocket-Ereignisse anbinden, sodass ein menschlicher Spieler gegen drei KI-Spieler ein komplettes Spiel durchspielen kann.

## Offen - Prioritaet 7: KI und Spielbarkeit im Einzelspielermodus

- [ ] Regelkonforme KI-Zuglogik auf Basis gueltiger Karten aufbauen; keine zufaellige oder illegale Kartenwahl.
- [ ] Einfache, nachvollziehbare Heuristiken aus `specs/ki-strategie.md` implementieren: Trumpfmanagement, Partnerunterstuetzung, Ansagen, Sonderpunkt-Bewusstsein.
- [ ] Entscheidungen fuer Vorbehalte, Armut-Annahme und Soli in die KI integrieren.
- [ ] End-to-End-Szenarien "1 Mensch + 3 KI" und "4 KI" automatisiert pruefen.

## Offen - Prioritaet 8: Robustheit und UI-Politur

- [ ] Verbindungsabbruch-Handling gemaess `specs/verbindungsabbruch.md` nachziehen; fuer das erste Singleplayer-MVP nachrangig.
- [ ] Animationen gemaess `specs/frontend-animationen.md` ergaenzen: Austeilen, Ausspielen, Stich einziehen, Ansage-Banner, Sonderpunkt-Hinweise, Rundenende.
- [ ] Responsive Verhalten, visuelle Plausibilitaet und Bedienbarkeit der Tischansicht verbessern.

## Empfohlene Umsetzungsreihenfolge fuer den ersten spielbaren End-to-End-Vertical-Slice

- [x] Zuerst Projektgrundgeruest, Build und Test-Setup herstellen.
- [x] Dann Kartenmodell, Trumpfordnung und Stichlogik inklusive Tests fertigstellen.
- [x] Danach Spielablauf fuer ein Normalspiel ohne Sonderspiele vertikal bis zur Auswertung durchziehen.
- [ ] Anschliessend KI fuer regelkonformes Spielen und ein minimales Frontend fuer Lobby + Tischansicht anbinden.
- [ ] Erst danach Ansagen, Sonderpunkte, Hochzeit, Armut und Solo-Varianten schrittweise ergaenzen.

## Aktuelle Risiken / offene Architekturentscheidungen

- [x] Fuer den aktuellen Slice ist entschieden, vorerst eine explizite immutable Zustandslogik statt Spring Statemachine zu verwenden; falls WebSocket-Orchestrierung spaeter echten Mehrwert bringt, kann darauf aufgesetzt werden.
- [ ] Frueh entscheiden, welche Teile des Spielzustands persistiert und welche nur im Speicher gehalten werden, damit Lobby, Reconnect und Tests konsistent bleiben.
- [ ] Karten-Assets, UI-Stil und Frontend-Testtiefe muessen beim Frontend-Setup frueh konkretisiert werden, sonst blockieren sie spaeter Tischansicht und Animationen.
