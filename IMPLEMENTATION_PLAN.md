# IMPLEMENTATION_PLAN

Stand: 2026-03-22

## Notiz

**Letzte Iteration (2026-03-22):** Vollstaendige Planungspruefung aller 5 Bounded Contexts (Lobby, Partie, Session, Frontend, Sonderspiele/KI) durch parallele Subagenten-Analyse. Alle Prioritaeten 0-11 sind abgeschlossen. 105 Backend-Tests und 32 Frontend-Tests gruen. Neue Befunde: Partei-Sichtbarkeit nach Grundansage nicht aktualisiert (Spec-Abweichung), fehlende Integrationstests fuer Hochzeit-Stilles-Solo, KI-Heuristiken undokumentiert.

**Naechster logischer Schritt:** Die verbliebenen Aufgaben in Prioritaet 12 (Korrekturen und Politur) adressieren die bei der Planungspruefung gefundenen Spec-Abweichungen, Test-Luecken und Dokumentationsmaengel. Danach waere das Projekt bereit fuer Produktions-Deployment (PostgreSQL-Konfiguration, echtes JAR) oder weitere Feature-Erweiterungen.

**Offene Fragen:** jsdom kann Canvas 2D nicht rendern (daher stderr-Warnings in Tests); unkritisch. WebSocket-Event-Architektur weicht von Spec ab (Snapshots statt separate Events). Frontend-Rendering basiert auf innerHTML-Strings statt einem reaktiven Framework; skaliert fuer den aktuellen Umfang.

Ausgangslage: Backend und Frontend sind funktional weitgehend vollstaendig: Karten-/Trumpf-/Stichlogik, alle Spielphasen, Ansagen, Sonderpunkte, alle Vorbehalte (Soli, Hochzeit, Armut), Persistenz, Session, Lobby, REST-API, WebSocket-Aktionen, Partie-Snapshots, KI-Strategie und KI-Orchestrierung sind implementiert und getestet. Das Frontend bietet eine interaktive Tischansicht mit Kartenklick, Vorbehalt-/Ansage-/Armut-Dialogen, Stichmitte, Ergebnis-Overlay und erste Animationen. Ein Spiel 1 Mensch + 3 KI ist End-to-End durchspielbar. Der naechste Schwerpunkt liegt auf visueller Politur (Kartengrafiken, fehlende Animationen), Robustheit (Verbindungsabbruch, Session-Cleanup) und dem geplanten Architektur-Refactoring (JPA → Spring Data JDBC, Package-Struktur nach Bounded Contexts).

## Erledigt / vorhanden
- [x] Produktziel und MVP-Rahmen in `PRD.md` beschrieben.
- [x] Fachspezifikationen in `specs/` liegen fuer die Kernbereiche vor: Kartendeck, Trumpfhierarchie, Stichlogik, Spielablauf, Ansagen, Punkteberechnung, Sonderpunkte, Lobby, REST-API, WebSocket-Kommunikation, Session, KI, Tischkonfiguration, Frontend-Tischansicht, Frontend-UI-Logik, Animationen, Sonderspiele.
- [x] Lokale Arbeitsumgebung fuer Java 25, Maven, Node.js und Chromium ist ueber `Dockerfile` und `docker-compose.yml` beschrieben.
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
- [x] Die Vorbehaltsphase kann jetzt auch `Hochzeit` aufloesen: ein Spieler mit beiden Kreuz-Damen darf die Hochzeit regelkonform anmelden, der Hochzeits-Spieler ist von Beginn an offen, der erste fremde Stichgewinner wird waehrend der Stichphase als Partner in Re verschoben, und nach drei eigenen Klaerungsstichen kippt das Spiel in ein stilles Solo.
- [x] Neue Backend-Tests sichern WARUM dieser Ausbau wichtig ist: Sie pruefen die Zulaessigkeit der Hochzeit, die Prioritaet Solo > Hochzeit, die Partnerfindung ueber den ersten fremden Stich und den Umschlag ins stille Solo, damit die Parteiwahrheit trotz dynamischer Klaerung serverseitig stabil bleibt.
- [x] Die Vorbehaltsphase kann jetzt auch `Armut` aufloesen: ein Spieler mit hoechstens drei Truempfen darf regelkonform Armut melden, bietet genau seine Trumpfkarten in einer eigenen `ARMUT_TAUSCH`-Phase an, die Antwort laeuft reihum links vom Armut-Spieler, der annehmende Spieler tauscht dieselbe Kartenzahl zurueck und wird offener Re-Partner; wenn niemand annimmt, wird das Spiel neu eingeworfen und wieder in die Vorbehaltsrunde versetzt.
- [x] Neue Backend-Tests sichern WARUM dieser Ausbau wichtig ist: Sie fixieren die Armut-Erkennung, pruefen den validierten Kartentausch und die offene Re-Parteibildung nach Annahme und verhindern mit dem Einwurf-Szenario, dass eine abgelehnte Armut in einem inkonsistenten Spielzustand haengen bleibt.
- [x] Die weiteren Solo-Varianten `Damensolo`, `Bubensolo` und `Fleischlos` sind jetzt in Vorbehalt, Trumpf-/Fehllogik und Parteibildung integriert: Alle Soli teilen dieselbe Prioritaet, werden bei Gleichstand ueber Sitzreihenfolge aufgeloest, lassen sich einzeln ueber `Spielregeln` deaktivieren und nutzen eigene TrumpfOrdnungen fuer nur Damen, nur Buben bzw. gar keinen Trumpf.
- [x] Neue Backend-Tests sichern WARUM dieser Ausbau wichtig ist: Sie fixieren fuer die neuen Soli Trumpferkennung, Fehlrangfolge und Bedienpflicht, pruefen den Fleischlos-Stich ohne Stechen und verhindern, dass Vorbehalt-Aufloesung oder Tischkonfiguration spaeter inkonsistente Solo-Regeln erzeugen.
- [x] Eine erste Persistenzgrundlage liegt jetzt in `src/main/java/de/locodoko/spielverwaltung/persistenz`: JPA-Entitaeten und Spring-Data-Repositories fuer Tisch, Tischkonfiguration, Spieler, Partie, Spiel, Hand, Stich und gespielte Karten bilden den Lobby-/Session-Kern sowie Spiel-Snapshots H2-tauglich ab; `application-dev.properties` erzeugt das Schema jetzt automatisch, waehrend `application-prod.properties` bei `validate` bleibt.
- [x] Neue JPA-Tests sichern WARUM diese Persistenz wichtig ist: Sie pruefen das komplette Abspeichern und Wiedereinlesen eines Tisch-/Partie-/Stichgraphs, erzwingen eindeutige Session-IDs, validieren ungueltige Tischkonfigurationen frueh und belegen, dass das Loeschen eines Tisches die zugehoerigen Spielhistorien sauber entfernt, ohne Spieleridentitaeten zu verlieren.
- [x] Die Session-basierte Spieleridentifikation liegt jetzt in `src/main/java/de/locodoko/spielverwaltung/session`: `POST/GET/PUT /api/spieler/session` registrieren und erkennen menschliche Spieler ueber `HttpSession`, validieren serverseitig unbekannte Sessions, setzen einen konfigurierbaren 60-Minuten-Timeout und erlauben Namensaenderungen nur ausserhalb eines Tisches; `KiSpielerFabrik` vergibt automatische KI-Namen ohne Cookie.
- [x] Neue Session-/KI-Tests sichern WARUM dieser Schritt wichtig ist: Sie pruefen Session-Erstellung und Wiedererkennung, erzwingen die serverseitige Ablehnung verwaister Sessions, fixieren das 60-Minuten-Timeout und verhindern mit der KI-Namensvergabe und der Tischsperre bei Namensaenderungen, dass Lobby- und Session-Logik spaeter inkonsistente Spieleridentitaeten erzeugen.
- [x] REST-API und serverseitige Lobby-Grundlage liegen jetzt in `src/main/java/de/locodoko/spielverwaltung/tisch`: `GET/POST /api/tische`, Beitreten/Verlassen/Starten, Konfiguration lesen/aendern sowie `GET /api/partien/{id}/stand` sind als JSON-Endpunkte mit DTOs, strukturierter Fehlerantwort, Logging und Session-/Konfliktvalidierung umgesetzt; beim Start wird ein wartender Tisch auf vier Spieler mit KI aufgefuellt und mit einer ersten `PartieEntity` in den laufenden Zustand ueberfuehrt.
- [x] Neue MockMvc-Tests sichern WARUM dieser Ausbau wichtig ist: Sie pruefen offene Tischlisten, Tisch-Erstellung und -Beitritt, Erstellerwechsel beim Verlassen, KI-Auffuellen beim Start, Konfigurations-Update, strukturierte 400/404/409-Fehler und den abrufbaren Partie-Stand, damit Frontend und spaetere WebSocket-Orchestrierung auf eine stabile HTTP-Vertragsbasis bauen koennen.
- [x] WebSocket/STOMP liegt fuer den aktuellen Lobby-/Partie-Slice jetzt in `src/main/java/de/locodoko/spielverwaltung/websocket`: Ein session-validierter STOMP-Endpunkt `/ws`, Snapshot-Anfragen ueber `/app/.../snapshot` sowie Broadcasts auf `/topic/tische`, `/topic/tisch/{id}` und `/topic/partie/{id}` publizieren Tischliste, Tischzustand und Partiestand nach Tisch-Erstellung, Beitritt, Verlassen, Konfigurationsaenderung und Spielstart in Echtzeit; ausgehende Nachrichten tragen Timestamps und benutzerbezogene Antworten laufen ueber `/user/queue/...`.
- [x] Neue WebSocket-Tests sichern WARUM dieser Schritt wichtig ist: Sie pruefen den Handshake gegen bekannte HTTP-Sessions und verankern, dass Lobby-Updates, Spielstart-Events, Partiestand-Snapshots und benutzerbezogene Snapshot-Antworten wirklich publiziert werden, damit Frontend und spaetere Spielzug-Handler nicht auf Polling oder implizite Seiteneffekte angewiesen sind.
- [x] Das Frontend hat jetzt einen ersten echten Vertical Slice in `frontend/src`: Boot-, Lobby- und Tisch-Szenen, HTML-Overlay ueber dem Phaser-Canvas, generierte Fallback-Assets fuer Filz/Karten, Session-Initialisierung, REST-Client, STOMP-Client und ein zentraler `AppStore` verbinden das Frontend mit den vorhandenen Lobby-/Tisch-/Partie-Snapshots des Backends.
- [x] Neue Frontend-Tests sichern WARUM dieser Schritt wichtig ist: Sie fixieren die Sitzordnung relativ zum aktuellen Spieler und pruefen den `AppStore` fuer Session-Initialisierung, Tisch-Snapshot-Handling und die Rueckkehr in die Lobby, damit weitere UI-Logik spaeter nicht auf impliziten Zustand oder manuelle Browser-Checks angewiesen ist.
- [x] Beim Tischstart wird jetzt in `src/main/java/de/locodoko/spielverwaltung/tisch` sofort ein echtes erstes Spiel mit ausgeteilten Haenden angelegt; `PartieStandAntwort` liefert fuer REST/WebSocket einen laufenden Spiel-Snapshot mit Geber, Phase, Sitzpositionen, Kartenanzahl, eigener sichtbarer Hand und spielerspezifischen Vorbehalts-/Aktionsoptionen.
- [x] Neue Tests sichern WARUM dieser Ausbau wichtig ist: Der Backend-Test erzwingt, dass der Tischstart nicht bei einer leeren Partie stehenbleibt, sondern sofort vier Haende fuer die erste Vorbehaltsrunde persistiert; der Frontend-Test fixiert, dass die Tischansicht echte Snapshot-Daten nutzt und nur die eigene Hand offen anzeigt, damit weitere UI-Logik spaeter auf einem belastbaren serverseitigen Wahrheitsstand aufsetzt.
- [x] Die Tischansicht in `frontend/src/szenen/TischSzene.ts` rendert jetzt einen echten Spielstart-Zustand statt eines Platzhalters: Spielerpositionen stammen aus dem Backend-Snapshot, die eigene Hand ist offen, Gegnerhaende bleiben verdeckt, der aktuelle Spieler/Phase wird sichtbar hervorgehoben und moegliche Vorbehalte werden angezeigt.
- [x] Die Tischansicht wurde weiter vervollstaendigt: Das Frontend sortiert sichtbare Haende regelkonform fuer die Anzeige, zeigt Geber-/Partei-/Stichstatus deutlicher, rendert Backend-Optionen im HUD und besitzt jetzt einen echten Debug-Modus, der per benutzerbezogenem WebSocket-Debug-Snapshot alle Haende nur fuer den anfragenden Entwickler offenlegt.
- [x] Neue Tests sichern WARUM dieser Ausbau wichtig ist: Der WebSocket-Test verhindert, dass der Debug-Modus versehentlich broadcastet statt nur benutzerbezogen alle Haende zu liefern; die Frontend-Tests fixieren Handsortierung und Debug-Durchreichung, damit spaetere Tisch- oder Replay-Ansichten keine widerspruechliche Kartenreihenfolge oder Entwickler-Sicht erzeugen.
- [x] Ein erster echter Spielaktions-Slice der Prioritaet 6 ist jetzt serverseitig geschlossen: `/app/tisch/{id}/vorbehalt` und `/app/tisch/{id}/armut-antwort` sind als WebSocket-Handler mit DTOs, serverseitiger Reihenfolgen-/Regelvalidierung, persistiertem Vorbehalt-/Armut-Status und automatischen Broadcasts plus benutzerbezogenen Partie-Snapshots umgesetzt.
- [x] Neue WebSocket-Integrationstests sichern WARUM dieser Slice wichtig ist: Sie pruefen gueltige/ungueltige Vorbehalte sowie den kompletten Armut-Fluss aus Angebot, Ablehnung und Annahme und verhindern damit, dass das Frontend spaeter wieder auf manuelle Snapshot-Requests oder implizite Zustandsaenderungen angewiesen ist.
- [x] Bei der aktuellen Code-Suche fanden sich keine offensichtlichen `TODO`-/`FIXME`-Marker und keine deaktivierten oder uebersprungenen Tests in `src/` oder `frontend/`; die Restluecken sind echte fehlende Features und keine bereits markierten Baustellen.
- [x] Der zweite Spielaktions-Slice der Prioritaet 6 ist jetzt ebenfalls serverseitig geschlossen: `/app/tisch/{id}/karte` und `/app/tisch/{id}/ansage` sind als WebSocket-Handler mit DTOs, serverseitiger Karten-/Ansagevalidierung, automatischen Partie-Broadcasts und benutzerbezogenen Folge-Snapshots umgesetzt; dafuer wurde die Persistenz um laufende Stichmitte, Ansagehistorie sowie dynamischen Hochzeit-Fortschritt erweitert.
- [x] `PartieStandAntwort` liefert fuer REST/WebSocket jetzt den fehlenden laufenden Aktionszustand: aktuelle Stichmitte mit Spielerzuordnung und Reihenfolge, oeffentliche Ansagehistorie sowie aus Ansagen abgeleitete Parteisicht sind im Snapshot enthalten, damit Frontend und spaetere KI denselben serverseitigen Wahrheitsstand erhalten.
- [x] Neue Backend-Tests sichern WARUM dieser Ausbau wichtig ist: Die WebSocket-Integrationstests pruefen gueltige/ungueltige Karten und Ansagen einschliesslich Broadcast-/Benutzersnapshot-Folgen, und der Persistenztest verankert, dass Ansagehistorie, laufende Stichmitte und Hochzeit-Fortschritt ueber Datenbank-Roundtrips stabil bleiben; genau diese Zustandswahrheit braucht der Echtzeitfluss ohne Polling oder implizite Client-Logik.
- [x] Der erste echte Frontend-Interaktionsslice fuer Prioritaet 7 ist jetzt umgesetzt: `frontend/src/modelle/SpielverwaltungDto.ts`, `frontend/src/model/TischAnsichtModell.ts`, `frontend/src/store/AppStore.ts` und `frontend/src/szenen/TischSzene.ts` verarbeiten laufende Stichmitte und Ansagehistorie, drehen die Sitzordnung relativ zum eigenen Spieler, senden Karten-/Ansage-/Vorbehalt-/Armut-Aktionen an die vorhandenen WebSocket-Kanaele und bieten dafuer sichtbare Ansage-, Vorbehalt- und Armut-Dialoge an.
- [x] Neue Frontend-Tests sichern WARUM dieser Ausbau wichtig ist: Die Modelltests fixieren jetzt Rotationslogik, aktuelle Stichmitte, Ansagehistorie und die aus Snapshot-Daten abgeleitete Armut-Interaktion; die Store-Tests verankern ausgehende Spielaktionen ueber alle vier WebSocket-Kanaele, damit der Browser-Spielfluss nicht wieder auf eine rein lesende Snapshot-Ansicht zurueckfaellt.
- [x] Ein erster Prioritaet-9-Animationsslice ist jetzt umgesetzt: `frontend/src/services/AnimationenService.ts` kapselt Phaser-Tweens fuer Kartenbewegungen, `frontend/src/szenen/TischSzene.ts` animiert das Ausspielen eigener Karten in die Stichmitte und zieht einen neu abgeschlossenen Stich nach kurzer Sichtpause gesammelt zum Gewinner ein; dadurch bleibt die Kausalitaet im Echtzeitfluss sichtbar, statt dass Karten nur sprunghaft zwischen Snapshots wechseln.
- [x] Neue Frontend-Tests sichern WARUM dieser Slice wichtig ist: `frontend/src/services/AnimationenService.test.ts` verankert Dauer und Wartefenster fuer Ausspiel-/Stichanimationen, und `frontend/src/szenen/TischSzene.test.ts` prueft, dass Kartenklicks wirklich zuerst animiert und neu abgeschlossene Stiche nach dem Snapshotwechsel als gebuendelter Einzug dargestellt werden.

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

- [x] Vorbehalt-Logik mit Priorisierung Solo > Hochzeit > Armut fertigstellen; `Trumpfsolo`, `Hochzeit` und `Armut` sind umgesetzt.
- [x] Hochzeit gemaess `specs/hochzeit.md` implementieren, inklusive Partnerfindung ueber den ersten gewonnenen Stich.
- [x] Armut gemaess `specs/armut.md` implementieren, inklusive Angebot, Annahme, validiertem Kartentausch und Einwurf bei kompletter Ablehnung.
- [x] Solo-Varianten in sinnvoller Reihenfolge umsetzen: `solo-dame.md`, `solo-bube.md` und `solo-fleischlos.md` sind jetzt zusaetzlich zu `solo-trumpf.md` umgesetzt.
- [x] Pro weiterem Sonderspiel gezielte Unit- und Integrationsfaelle aufbauen; fuer `Trumpfsolo`, `Hochzeit`, `Armut`, `Damensolo`, `Bubensolo` und `Fleischlos` liegen diese Absicherungen jetzt vor, weil diese Regeln tief in Trumpf- und Parteilogik eingreifen.

## Offen - Prioritaet 5: Persistenz, Session, Lobby und Schnittstellen

- [x] JPA-Entitaeten und Repositories gemaess `specs/datenbankmodell.md` anlegen, zunaechst H2-tauglich und spaeter PostgreSQL-kompatibel.
- [x] Session-basierte Spieleridentifikation gemaess `specs/spieler-session.md` umsetzen.
- [x] REST-API gemaess `specs/rest-api.md` bereitstellen: Tische listen/anlegen/beitreten, Konfiguration lesen/aendern, Spielstand abrufen.
- [x] Lobby-Domaene und Tischverwaltung gemaess `specs/lobby.md` implementieren, inklusive Begrenzung auf einen Tisch pro Spieler und KI-Auffuellen beim Start.
- [x] WebSocket/STOMP-Kommunikation gemaess `specs/websocket-kommunikation.md` anbinden, damit Lobby- und Spielzustand in Echtzeit publiziert werden.

## Offen - Prioritaet 6: Echte Spielinteraktion und Echtzeit-Orchestrierung

- [x] Die bisher nur teilweise umgesetzte WebSocket-Spec `specs/websocket-kommunikation.md` ist fuer die aktuell fehlenden spielrelevanten Aktionen vervollstaendigt: `/app/tisch/{id}/karte` und `/app/tisch/{id}/ansage` sind jetzt inklusive DTOs, serverseitiger Validierung und benutzerbezogener Snapshot-Folgeevents umgesetzt; `/app/tisch/{id}/vorbehalt` und `/app/tisch/{id}/armut-antwort` waren bereits vorhanden.
- [x] Der serverseitige Partie-Snapshot ist fuer den laufenden Aktionsfluss erweitert: `moeglicheAnsagen`, aktuelle Spielerreihenfolge in Vorbehalt/Armut, aktuelle Stichmitte mit gespielten Karten und oeffentliche Ansagehistorie sind jetzt vorhanden; dadurch koennen Frontend und spaetere KI denselben unmittelbaren Wahrheitsstand lesen.
- [x] Nach jeder spielrelevanten Mutation dieses Slices werden automatische Folgeereignisse an die Partie publiziert, damit Frontend und KI nicht auf manuelle Snapshot-Anfragen angewiesen bleiben und der Echtzeitfluss Start -> Aktion -> Broadcast -> naechster Zustand fuer Vorbehalt, Armut, Kartenlegen und Ansagen wirklich entsteht.
- [x] Fuer diese Orchestrierung sind gezielte Backend-Tests vorhanden: WebSocket-Validierung fuer gueltige/ungueltige Karten und Ansagen ist jetzt ebenso abgesichert wie die bereits vorhandenen Broadcastfaelle fuer Vorbehalte und Armut-Antworten.

## Offen - Prioritaet 7: Spielbares Frontend

- [x] Frontend-Grundgeruest mit Routing/Scene-Struktur, Asset-Loading und Verbindung zum Backend aufbauen.
- [x] Lobby-Ansicht zum Erstellen, Beitreten und Starten von Tischen implementieren.
- [x] Tischansicht gemaess `specs/frontend-tischansicht.md` weiter vervollstaendigen: Der bisher noch offene konfigurierbare Tischhintergrund ist jetzt End-to-End umgesetzt. `TischKonfigurationDto`/Persistenz tragen mit `Tischhintergrund` einen expliziten Vertragswert, `TischSzene` rendert dafuer mehrere Hintergrundtexturen mit Filz-Fallback und bietet im wartenden Tisch eine direkte Auswahl fuer den Ersteller an, und neue Backend-/Frontend-Tests sichern WARUM dieser Slice wichtig ist: Ohne den serverseitigen Konfigurationswert wuerde die Tischansicht trotz vorhandener Interaktion visuell auf einem einzigen Fallback stehen bleiben und die Spec-Luecke unbemerkt wieder aufreissen.
- [x] UI-Logik gemaess `specs/frontend-ui-logik.md` vervollstaendigen: `TischSzene` nutzt jetzt interaktive Karten mit Hover/Klick, zeigt phasenabhaengige Ansagebereiche sowie sichtbare Vorbehalt- und Armut-Dialoge und leitet die Auswahl konsequent aus serverseitigen Optionen ab.
- [x] `AppStore`, Echtzeit-Port und `TischSzene` um einen echten Aktionsfluss erweitern: Fuer die vorhandenen Backend-Kanaele `/app/tisch/{id}/karte`, `/ansage`, `/vorbehalt` und `/armut-antwort` existieren jetzt Frontend-DTOS, Store-Methoden, UI-Ausloeser und ein durchgehender Zustandsfluss fuer Vorbehaltwahl, Armut-Annahme/Ablehnung und Kartenauswahl fuer Angebot bzw. Rueckgabe.
- [x] Frontend-Ergaenzungen fuer Armut-/Vorbehalt-/Ansage-Dialoge, ein nutzbares Punktestand-/Ergebnis-Overlay und eine Letzte-Stiche-Ansicht sind jetzt End-to-End umgesetzt: `PartieStandAntwort` liefert dafuer explizit `letztesSpielergebnis` und `letzteAbgeschlosseneStiche`, `SpielverwaltungDto`/`TischAnsichtModell` verdrahten diese Daten fuer relative Sitzsicht, und `TischSzene` zeigt daraus die letzte Auswertung samt Spielwert/Augen/Sonderpunkten sowie eine umschaltbare Letzte-Stiche-Ansicht.
- [x] Frontend-Tests deutlich verbreitern: Zusaetzlich zu Modell- und Store-Tests deckt `frontend/src/szenen/TischSzene.test.ts` jetzt echte Pointer/Hover/Klick-Interaktionen, serverseitig abgeleitete Vorbehalt-/Ansage-/Armut-UI, Resize-Neurendering und einen klaren DOM-Fehlerfall fuer `#ui-root` ab; diese Absicherung ist wichtig, weil die spielbare Tischansicht sonst trotz gruener Modell-/Store-Tests im Phaser-/DOM-Zusammenspiel unbemerkt regressieren koennte.

## Offen - Prioritaet 8: KI und Spielbarkeit im Einzelspielermodus

- [x] Eine echte KI-Strategie gemaess `specs/ki-strategie.md` ist jetzt eingezogen statt nur KI-Spieler anzulegen: Unter `src/main/java/de/locodoko/spiel/ki` kapseln `KiStrategie`, `KiSpielzustand`, `KiArmutAntwort` und `StandardKiStrategie` eine deterministische Karten-, Vorbehalt-, Armut- und Ansagewahl, die ausschliesslich auf gueltigen serverseitigen Optionen aufsetzt und keine illegalen oder rein zufaelligen Zuege erzeugt.
- [x] Nachvollziehbare Heuristiken fuer Trumpfmanagement, Partnerunterstuetzung, Ansagen und Sonderpunkt-Bewusstsein sind jetzt vorhanden: Die Standard-KI spielt niedrige Gewinnkarten bevorzugt zum Stechen, schmiert sichtbare Partnerstiche, schuetzt teure Karten wie Fuchs/Karlchen beim Abwurf, bewertet Handstaerke fuer Re/Kontra und Solo-Entscheidungen und bietet bei Armut exakt alle Truempfe an bzw. gibt nach Annahme deterministisch schwache Karten zurueck.
- [x] Entscheidungen fuer Vorbehalte, Armut-Annahme, Hochzeit/Solo-Situationen und spaetere Ansagen sind in die KI integriert, damit der komplette Phasenfluss ohne menschliche Eingriffe durchlaufen werden kann; zugleich behebt `SpielPersistenzAdapter` einen dabei aufgedeckten Koppelfehler in der Rekonstruktion laufender Normalspiele, indem Parteien und Ergebnisse jetzt auch nach bereits gespielten Kreuz-Damen bzw. nach persistierten Resultaten korrekt wiederhergestellt werden.
- [x] KI-Orchestrierung ist jetzt in den Spielfluss eingebaut: `KiOrchestrierungService` haengt direkt in `TischService` am Tischstart sowie an menschlichen Vorbehalt-/Armut-/Karten-/Ansageaktionen, triggert anschliessende KI-Zuege, wertet Spiele automatisch aus, aktualisiert den Gesamtstand, startet Folge-Spiele derselben Partie und stoppt erst wieder bei einem menschlichen Zug oder am Partieende; damit funktionieren sowohl 1 Mensch + 3 KI als auch 4 KI ohne Polling oder manuelle Backend-Eingriffe.
- [x] End-to-End-Szenarien "1 Mensch + 3 KI" und "4 KI" sind jetzt automatisiert geprueft: `StandardKiStrategieTest` sichert WARUM die heuristische Auswahl wichtig ist (Solo-/Armut-/Ansage-/Schmierverhalten), und `KiOrchestrierungServiceIntegrationTest` beweist WARUM die neue Backend-Orchestrierung kritisch ist, indem ein Mensch-gegen-3-KI-Stich bis zum naechsten menschlichen Zug sowie eine komplette 4-KI-Partie bis zum Partieende serverseitig durchlaufen.

## Offen - Prioritaet 9: Frontend-Politur und Animationen

- [x] Reale Karten-Sprites mit franzoesischem Blatt (48 Karten + Rueckseite) auf das bestehende Fallback-Setup aufsetzen; jetzt per HTML Canvas 2D generiert: Farbsymbol, Wertkuerzel in den Ecken, grosses Symbol in der Mitte, Schwarz/Rot-Faerbung.
- [x] Karten-Austeilen-Animation gemaess `specs/frontend-animationen.md` ergaenzt: `AnimationenService.animiereKartenAusteilen()` animiert Karten gestaffelt (75ms/Karte) von der Tischmitte zu den Handpositionen; eigene offen, gegnerische verdeckt; `TischSzene` erkennt neues Spiel ueber spielNummer-Aenderung und blendet echte Karten waehrend der Animation aus.
- [x] Ansage-Banner-Animation ergaenzt: Bei Re/Kontra/Absage ein Pop-up-Banner mit Spielername und Fade-In/Out (1,5s sichtbar); `AnimationenService.animiereAnsageBanner()` per `tweenAlpha` und `warte`; `TischSzene` erkennt neue Ansagen per `ermittleNeueAnsagen()` und zeigt das Banner sequenziell.
- [x] Sonderpunkt-Feedback-Animation ergaenzt: Bei Fuchs/Karlchen/Doppelkopf goldenes Fade-In/Out-Banner (1s sichtbar); `AnimationenService.animiereSonderpunktFeedback()` und `TischSzene.ermittleNeueSonderpunkte()` erkennen neues Spielergebnis und zeigen Sonderpunkte sequenziell an.
- [x] Rundenende-Overlay als modalen Dialog umsetzen: Augen, Spielpunkte, Sonderpunkte, bleibt bis Spieler schliesst; aktuell nur als Sektion im rechten UI-Panel, geht leicht unter.
- [x] Responsive Verhalten, visuelle Plausibilitaet und Bedienbarkeit der Tischansicht verbessert: Karten skalieren relativ zur Spielbreite, Stich-Slot-Positionen und Faecherabstaende sind relativ; Modal schliesst per Escape-Taste und Backdrop-Klick.

## Offen - Prioritaet 10: Robustheit und Backend-Haertung

- [x] Verbindungsabbruch-Handling gemaess `specs/verbindungsabbruch.md`: `VerbindungsSessionEreignisListener` lauscht auf `SessionConnectedEvent`/`SessionDisconnectEvent` und leitet an `VerbindungsabbruchService` weiter; dieser trackt getrennte Sessions in-memory, sendet GETRENNT-/VERBUNDEN-/KI_UEBERNOMMEN-Ereignisse an `/topic/tisch/{id}`, stellt dem reconnectenden Spieler den aktuellen Spielzustand zu, und ein `@Scheduled`-Task prueft alle 10 Sekunden auf abgelaufene Timeouts (Standard: 120 s) und setzt `SpielerEntity.kiUebernommen = true`, bevor die KI-Orchestrierung fuer diesen Spieler ausgeloest wird; beim Spielwechsel wird `kiUebernommen` automatisch zurueckgesetzt damit reconnectete Spieler ihr naechstes Spiel wieder selbst steuern.
- [x] Session-Cleanup bei Timeout: `SpielerSessionCleanupService` + `SpielerSessionCleanupKonfiguration` (HttpSessionListener via ServletListenerRegistrationBean). Wartende Tische: Spieler entfernt, leere Tische geloescht, Broadcasts; aktive Tische: Session-ID geleert, KI spielt weiter.
- [x] Concurrency-Absicherung in TischService: Pessimistisches Write-Lock (PESSIMISTIC_WRITE) via `TischRepository.findByIdWithLock()` fuer alle schreibenden Operationen (betreteTisch, starteTisch, verlasseTisch, aktualisiereKonfiguration). Neue Tests sichern TISCH_VOLL-409 und TISCH_BEREITS_GESTARTET-409 ab.
- [x] Exception-Hierarchie konsistent machen: `SpielerSessionUngueltigException` und `SpielerNameAenderungNichtErlaubtException` haben jetzt `fehlerCode()`-Methoden; Handler rufen `fehlerCode()` statt hartkodierten Strings auf.
- [x] PartieController mit Session-Validierung schuetzen: `GET /api/partien/{id}/stand` prueft aktuell keine Session; jeder kann jeden Partie-Stand abrufen.
- [x] KiOrchestrierungService: Fehlerbehandlung fuer KI-Strategie-Exceptions ergaenzen, damit Partie bei KI-Fehler nicht in inkonsistentem Zustand haengt. `fuehreKiAktionAus()`-Aufruf mit try-catch abgesichert; Exception wird geloggt, Methode kehrt zurueck ohne Persistenzupdate — DB-Stand bleibt konsistent. Zwei neue Integrationstests in `KiOrchestrierungServiceFehlerTest` (Stichphase + Vorbehaltphase).
- [x] Test-Luecken schliessen: Tisch-voll-409 und armutErlaubt=false-Ablehnung waren bereits durch bestehende Tests abgedeckt (`TischControllerTest.verhindertBeitrittWennTischVollIst`, `SpielTest.lehntArmutMitMehrAlsDreiTrumpfenOderBeiDeaktivierterRegelAb`). Fehlende WebSocket-Tests fuer wiederholte Armut-Einwuerfe hinzugefuegt: `wirftSpielEinWennNiemandDieArmutPerWebSocketAnnimmt` prueft Broadcast mit VORBEHALT_ANSAGE und 12 Karten pro Spieler; `unterstuetztWiederholteArmutEinwuerfe` beweist zwei aufeinanderfolgende Einwuerfe ohne kuenstliche Grenze. 105 Backend-Tests gruen.

## Offen - Prioritaet 11: Architektur-Refactoring (teilweise erledigt)

- [x] Migration von JPA/Hibernate auf Spring Data JDBC gemaess `specs/architektur-ddd.md` und `specs/tech-migration.md`: `@Entity`/`@OneToMany`/`JpaRepository` durch `@Table`/`CrudRepository` ersetzen; betrifft alle Entities in `spielverwaltung/persistenz`.
- [x] Liquibase-Schema-Migration einrichten anstelle von `spring.jpa.hibernate.ddl-auto=create-drop`; YAML-Changelogs fuer alle Tabellen in `src/main/resources/db/changelog/`.
- [x] Package-Struktur nach Bounded Contexts aufgeloest gemaess `specs/architektur-ddd.md`: alle Klassen aus `spielverwaltung/` und `spiel/` in `lobby/`, `partie/`, `session/`, `karten/` reorganisiert; @EnableJdbcRepositories auf alle 3 Context-Packages erweitert; Cross-Package-Imports aufgeloest; 105 Tests gruen.
- [x] Vollstaendige Code-Dokumentation (Javadoc): Jede Klasse mit praeziser deutscher Definition und Zweck.
- [x] Toten Code pruefen und entfernen: `TischEreignisTyp`-Enum hatte entgegen Annahme keine ungenutzten Werte (alle 7 werden gesendet); identische `ladeAktivenSpieler(HttpServletRequest)`-Methode aus TischController und PartieController nach SpielerSessionService extrahiert.

## Offen - Prioritaet 12: Korrekturen und Politur (aus Planungspruefung 2026-03-22)

- [ ] Partei-Sichtbarkeit nach Grundansage aktualisieren: `Spiel.sageAn()` aktualisiert die Parteien-Sichtbarkeit nicht bei Re/Kontra-Grundansagen. Laut `specs/ansagen.md` offenbart ein Spieler durch eine Grundansage seine Parteizugehoerigkeit — das muss serverseitig in `Parteien` reflektiert werden, damit das Backend als einzige Wahrheitsquelle fungiert. Aktuell leitet das Frontend die Partei implizit aus der Ansagehistorie ab, was funktional aequivalent ist, aber gegen das Architekturprinzip verstoesst.
- [ ] Integrationstests fuer Hochzeit-Stilles-Solo: Kein Test prueft aktuell den konkreten Kartenverlauf, bei dem der Hochzeitsspieler alle 3 Klaerungsstiche selbst gewinnt und das Spiel in ein stilles Solo umschlaegt. Die Logik in `Spiel.fortschrittNachVollstaendigemStich()` ist implementiert aber nur indirekt getestet.
- [ ] KI-Heuristiken dokumentieren: `StandardKiStrategie` enthaelt undokumentierte Gewichtsfaktoren (z.B. `trumpfAnzahl * 4 + asse * 2`) und Schwellwerte (z.B. `soloSchwelle SOLO_TRUMPF -> 34`). Vor einer Schwierigkeitsgrad-Erweiterung sollten diese Werte mit Kommentaren versehen werden, die die Kalibrierungsgrundlage erklaeren.
- [ ] KI-Hochzeit-Speziallogik: Die KI behandelt Hochzeit aktuell wie einen normalen Vorbehalt. Spezifische Strategien fuer "Partner sucht" vs. "Partner gefunden" sind nicht implementiert. Fuer MVP akzeptabel, aber fuer verbesserte KI-Qualitaet wuenschenswert.
- [ ] Spec-Status-Markierungen aktualisieren: Alle 8 Sonderspiel-/KI-/Verbindungsabbruch-Specs (`specs/hochzeit.md`, `specs/armut.md`, `specs/solo-*.md`, `specs/ki-strategie.md`, `specs/verbindungsabbruch.md`) sind noch mit `| Status | Noch nicht begonnen |` markiert, obwohl sie vollstaendig implementiert und getestet sind. Definition-of-Done-Checklisten in diesen Specs sind ebenfalls nicht abgehakt.

## Empfohlene Umsetzungsreihenfolge fuer den ersten spielbaren End-to-End-Vertical-Slice

- [x] Zuerst Projektgrundgeruest, Build und Test-Setup herstellen.
- [x] Dann Kartenmodell, Trumpfordnung und Stichlogik inklusive Tests fertigstellen.
- [x] Danach Spielablauf fuer ein Normalspiel ohne Sonderspiele vertikal bis zur Auswertung durchziehen.
- [x] Anschliessend die noch fehlenden serverseitigen Spielaktionskanaele, Folge-Broadcasts und vollstaendigen Partie-Snapshots fuer echte Interaktion umsetzen.
- [x] Danach das Frontend von der lesenden Snapshot-Ansicht zur interaktiven Tisch-UI mit Kartenklick, Vorbehalts-/Ansage-Dialogen und Stichmitte ausbauen.
- [x] Erst dann die KI fuer regelkonformes Spielen, Vorbehalte und Ansagen anbinden, damit 1 Mensch + 3 KI wirklich durchspielbar wird.
- [x] Danach die Vorbehalts-Sonderspiele fuer den aktuellen Backend-Slice vervollstaendigen (`Trumpfsolo`, `Hochzeit`, `Armut`, `Damensolo`, `Bubensolo`, `Fleischlos`).
- [x] Frontend-Politur: Kartengrafiken, Austeilen-/Ansage-/Sonderpunkt-Animationen, Rundenende-Overlay (Prioritaet 9).
- [x] Backend-Haertung: Verbindungsabbruch, Session-Cleanup, Concurrency, Test-Luecken (Prioritaet 10).
- [x] Architektur-Refactoring: JPA→JDBC, Liquibase, Package-Struktur, Javadoc, toter Code (Prioritaet 11).

## Aktuelle Risiken / offene Architekturentscheidungen

- [x] Fuer den aktuellen Slice ist entschieden, vorerst eine explizite immutable Zustandslogik statt Spring Statemachine zu verwenden; falls WebSocket-Orchestrierung spaeter echten Mehrwert bringt, kann darauf aufgesetzt werden.
- [x] Erste Persistenzentscheidung ist getroffen: Tisch, Konfiguration, Spieler sowie Partie-/Spiel-/Hand-/Stich-Snapshots werden relational gespeichert; Live-Orchestrierung fuer Session, Lobby-Workflows und Reconnect baut im naechsten Schritt darauf auf.
- [x] Die WebSocket-Spec ist fuer den aktuellen Spielaktions-Slice nicht mehr nur lesend: Snapshot-Anfragen, Lobby-Broadcasts, Debug-Sicht sowie die spielrelevanten Client->Server-Aktionen fuer Vorbehalt, Armut, Kartenlegen und Ansagen inklusive automatischer Folgeevents sind jetzt vorhanden.
- [x] `PartieStandAntwort` bildet den Spielzustand jetzt auch fuer Ergebnis-/Replay-UI explizit ab: Neben `moeglicheAnsagen`, `aktuelleStichmitte`, `ansageHistorie` und Parteisicht liefern die Snapshots jetzt auch `letztesSpielergebnis` sowie `letzteAbgeschlosseneStiche`, und diese Felder sind im Frontend bis in `TischSzene` verdrahtet.
- [x] Das Frontend ist nicht mehr nur lesend: Karten koennen serverseitig regelkonform per Hover/Klick gespielt werden, `AppStore` sendet neben Snapshot/Debug jetzt auch die spielrelevanten Aktionen, und fuer Vorbehalt sowie Armut existiert ein eigener Auswahlzustand; damit werden die vorhandenen Backend-Broadcasts erstmals zu echter Interaktion.
- [x] Fuer die in `specs/frontend-ui-logik.md` geforderte Letzte-Stiche- und Ergebnisdarstellung existiert jetzt ein passender End-to-End-Vertrag: `PartieStandAntwort` liefert eine explizite abgeschlossene Stichhistorie plus Ergebnisobjekt, und das Frontend rendert daraus Letzte-Stiche- und Ergebnis-Overlay ohne lokale Nachberechnung.
- [x] Die KI ist nicht mehr nur Spielererzeugung/Namensvergabe: Neben einer echten Entscheidungslogik fuer Vorbehalt, Armut, Ansage und Kartenwahl existiert jetzt eine serverseitige Orchestrierung, die nach menschlichen oder KI-Aktionen automatisch weitere KI-Zuege ausloest und Spiele/Partien bis zum naechsten menschlichen Eingriff oder bis zum Ende fortschreibt.
- [ ] WebSocket-Event-Architektur weicht von Spec ab: Spec verlangt separate Events (StichGewonnen, AnsageErfolgt, SpielBeendet etc.), Implementierung nutzt Snapshot-basierte Broadcasts ueber `PartieEreignisAntwort`; funktional aequivalent, aber nicht inkrementell — Entscheidung ob Spec angepasst oder Events nachgezogen werden muss noch fallen.
- [ ] KI-Heuristiken (Vorbehalt-Schwellwerte, Kosten-Berechnung) enthalten magische Zahlen ohne Dokumentation oder Kalibrierung; funktioniert fuer MVP, sollte aber vor Schwierigkeitsgrad-Erweiterung dokumentiert werden. Aufgabe in Prioritaet 12 erfasst.
- [ ] Frontend-Rendering basiert auf innerHTML-Strings statt einem reaktiven Framework; skaliert fuer den aktuellen Umfang, wird aber bei weiterer UI-Komplexitaet fragil.
- [ ] Partei-Sichtbarkeit nach Grundansage: `Spiel.sageAn()` aktualisiert `Parteien` nicht bei Re/Kontra — Backend spiegelt die Partei-Offenbarung nicht serverseitig wider. Aufgabe in Prioritaet 12 erfasst.

## Offen - Prioritaet 13: Session-Recovery und Tisch-Lebenszyklus

Ziel: "Erste spielbare Version" — Spieler koennen einen Tisch erstellen, eine Partie gegen KI starten, und der Tab-Reload oder ein versehentliches Verlassen bricht das Erlebnis nicht irreparabel ab. Loest den bekannten "Blur"-Folgefehler (Session haengt nach Fehler am Tisch fest).

- [ ] `GET /api/spieler/session` liefert `aktiverTischId` falls Spieler einem Tisch zugeordnet ist (gemaess `specs/verbindungsabbruch.md`, Abschnitt Session-Recovery).
- [ ] `BootSzene` prueft beim Start `aktiverTischId` und leitet direkt zur `TischSzene` weiter — kein manuelles Suchen in der Lobby nach Tab-Reload.
- [ ] WebSocket-Reconnect nach Redirect: `TischSzene` abonniert Topics neu und fordert Snapshot an; falls Tisch nicht mehr existiert, Weiterleitung zur Lobby.
- [ ] "Tisch verlassen"-Button in der Tischansicht (HUD) mit Bestaaetigungsdialog; loest `POST /api/tische/{id}/verlassen` aus.
- [ ] Backend: Verlassen waehrend laufender Partie setzt Partie auf `ABGEBROCHEN`, sendet `PARTIE_ABGEBROCHEN`-Event an alle Spieler am Tisch.
- [ ] Frontend: Nach `PARTIE_ABGEBROCHEN`-Event Weiterleitung aller Spieler zur Lobby mit Hinweis.
- [ ] Neue Partie nach Partie-Ende: Backend startet automatisch neue Partie mit denselben Spielern; Frontend zeigt 10-Sekunden-Countdown im Ergebnis-Overlay.
- [ ] Tests: Session-Recovery (Tab-Reload), Tisch-Verlassen-Abbruch, Neustart nach Partie-Ende.

## Offen - Prioritaet 14: Frontend-Logging und globaler Error-Handler

Ziel: Jeder Fehler im Frontend — ob Exception, stummer Absturz oder ausbleibende WebSocket-Nachricht — ist in der Browser-Konsole nachvollziehbar. Der "Blur"-Bug wird damit beim naechsten Auftreten sofort diagnostizierbar.

- [ ] `frontend/src/logger.ts` anlegen: Dev-Mode-Switch per `import.meta.env.DEV`, Kategorien WS/STORE/SZENE/API/ERROR (gemaess `specs/frontend-logging.md`).
- [ ] Globaler Error-Handler in `main.ts`: `window.onerror` und `unhandledrejection` — immer aktiv, auch im Prod-Build.
- [ ] Logging-Punkte in `SpielverwaltungEchtzeit.ts`: Verbindungsaufbau, Disconnect, jede eingehende/ausgehende Nachricht.
- [ ] Logging-Punkte in `AppStore.ts`: Session-Init, Tisch-/Partie-Snapshot, alle ausgehenden Aktionen.
- [ ] Logging-Punkte in `TischSzene.ts`: Scene-Start, Phasenwechsel (nicht pro Frame), Karten-Klick.
- [ ] Logging-Punkte in `SpielverwaltungApi.ts`: Jeder REST-Call mit Status, Fehler-Responses.
- [ ] Backend `KiOrchestrierungService`: strukturiertes Logging auf allen Orchestrierungsschritten (Start, KI-Zug, Stich, Spiel-Ende, Fehler) mit `tischId` und `spielphase`.
- [ ] `application-dev.properties`: Log-Level DEBUG fuer `KiOrchestrierungService` und `TischEchtzeitService`.
- [ ] Frontend-Test: Logger produziert im Prod-Build keinen Output.

## Offen - Prioritaet 15: E2E-Tests mit Playwright

Ziel: Automatisierter Regressionsschutz fuer den kritischen Pfad "Tisch erstellen → Partie gegen KI → erster Stich". Faengt den "Blur"-Bug und zukuenftige Regressionen reproduzierbar ab.

- [ ] `e2e/`-Verzeichnis als eigenstaendiges npm-Projekt anlegen (gemaess `specs/e2e-tests.md`).
- [ ] `e2e/playwright.config.ts` mit `baseURL` via `BASE_URL`-Umgebungsvariable (Standard: `http://localhost:8080`).
- [ ] `e2e/tests/partie-gegen-ki.spec.ts` implementiert alle 6 Schritte: App laden, Tisch erstellen, Partie startet, Vorbehaltsphase, erste Karte spielen, erster Stich abgeschlossen.
- [ ] Assertions: kein Blur-Zustand nach Tisch-Erstellen, Hand mit 12 Karten, Karte in Stichmitte, Stich wird Gewinner zugeschlagen, kein JS-Fehler in Konsole.
- [ ] `e2e/.gitignore` schliesst `node_modules/`, `test-results/`, `playwright-report/` aus.
- [ ] Hinweis in CLAUDE.md: E2E-Tests sind separat (`cd e2e && npx playwright test`), nicht Teil von `mvn verify`.
- [ ] Test laeuft lokal gruen gegen `mvn spring-boot:run`.

## Offen - Prioritaet 16: Java 25 / Spring Boot 4.x Upgrade

Ziel: `pom.xml` auf den in `specs/tech-migration.md` definierten Zielstand bringen — Java 25 und Spring Boot 4.x. JDBC/Liquibase-Migration ist bereits abgeschlossen (Prioritaet 11), nur das Versions-Upgrade steht noch aus.

- [ ] Spring Boot Parent auf `4.x` (latest stable) hochziehen.
- [ ] `java.version` in `pom.xml` auf `25` setzen.
- [ ] Compile-Fehler durch API-Aenderungen in Spring Boot 4.x beheben (Breaking Changes pruefen).
- [ ] `mvn clean verify` gruen: alle 105 Backend-Tests und 32 Frontend-Tests bestehen.
- [ ] `.java-version`-Datei auf `25` aktualisieren.
- [ ] `specs/tech-migration.md` Definition-of-Done abhaken.

## Offen - Prioritaet 17: Frontend-Dokumentation (JSDoc)

Ziel: Kritische Frontend-Klassen sind so dokumentiert, dass ein neuer Entwickler (oder Ralph in einem neuen Kontext) die Architektur ohne Codebase-Analyse versteht.

- [ ] JSDoc fuer `AppStore.ts`: Klasse und alle oeffentlichen Methoden (gemaess `specs/frontend-architektur.md`).
- [ ] JSDoc fuer `TischSzene.ts`: Klasse, `create`, Render-Methoden, Dialoge, Karten-Klick-Handler.
- [ ] JSDoc fuer `SpielverwaltungEchtzeit.ts`: Klasse und alle oeffentlichen Methoden.
- [ ] JSDoc fuer `TischAnsichtModell.ts`: Klasse und alle oeffentlichen Methoden.
- [ ] JSDoc fuer `AnimationenService.ts`: Klasse und alle oeffentlichen Methoden.
- [ ] `specs/frontend-architektur.md` auf aktuellem Stand (Dateistruktur, Datenfluss-Diagramm).
