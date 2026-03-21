# Datenbankmodell

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Noch nicht begonnen                         |
| Priorität      | Hoch                                        |
| Abhängigkeiten | kartendeck.md, spielablauf.md, spieler-session.md, tischkonfiguration.md, punkteberechnung.md |

## Beschreibung

Definition des Datenbankmodells für die persistente Speicherung aller spielrelevanten Daten. Das Modell bildet Tische, Partien, Spiele, Spieler, Hände, Stiche und Konfigurationen ab. 

**Technologie**: Spring Data JDBC (kein JPA/Hibernate) + Liquibase für Schema-Migration + Lombok für Boilerplate-Reduktion.

**Architektur**: Domain Model = Persistence Model (pragmatisches DDD). Aggregate Roots sind mutable, Value Objects sind immutable.

Für die Entwicklung wird H2 (In-Memory) verwendet, für die Produktion PostgreSQL.

## Anforderungen

### Aggregate Roots (mutable, mit @Table)

1. **`Tisch`** (Aggregate Root in `de.locodoko.lobby`)
   - Felder: id (UUID), name, status (WARTEND, IM_SPIEL, BEENDET), erstelltVonSpielerId (UUID FK), erstelltAm
   - Foreign Key: tischId in anderen Aggregates
   - Konfiguration: Als @Embedded oder Werte direkt im Tisch-Table

2. **`Spieler`** (Aggregate Root in `de.locodoko.session`)
   - Felder: id (UUID), name, sessionId, istKi, erstelltAm
   - Foreign Key: spielerId referenziert von anderen Aggregates

3. **`Partie`** (Aggregate Root in `de.locodoko.partie`)
   - Felder: id (UUID), tischId (UUID FK), anzahlSpiele, aktuellesSpielNummer, status (LAUFEND, BEENDET)
   - Foreign Key: tischId → Tisch (loose coupling)
   - Beziehung: 1 Partie → N Spiele (Aggregates laden via Repository)

4. **`Spiel`** (Entity innerhalb Partie-Aggregate)
   - Felder: id (UUID), partieId (UUID FK), spielNummer, geberSpielerId (UUID FK), spieltyp, status, ergebnis
   - Foreign Key: partieId → Partie
   - Beziehung: 1 Spiel → N Stiche, 1 Spiel → N Hände

5. **`Hand`**
   - Felder: id (UUID), spielId (UUID FK), spielerId (UUID FK), karten (JSON Array)
   - Repräsentiert die Karten eines Spielers in einem Spiel

6. **`Stich`**
   - Felder: id (UUID), spielId (UUID FK), stichNummer, gewinnerSpielerId (UUID FK), augen
   - Beziehung: 1 Stich → 4 GespielteKarten

7. **`GespielteKarte`**
   - Felder: id (UUID), stichId (UUID FK), spielerId (UUID FK), farbe (enum), wert (enum), position (int)

### Value Objects (immutable, kein @Table)

8. **`Karte`** (Value Object in `de.locodoko.karten`)
   - Felder: farbe (Farbe enum), wert (Kartenwert enum)
   - Liegt NUR im Code, nicht in DB als eigene Tabelle
   - Verwendung: In JSON-Feldern (`Hand.karten`), als Enum-Mapping (`GespielteKarte`)

9. **`Spielregeln`** (Value Object in `de.locodoko.karten`)
   - Felder: alle konfigurierbaren Optionen als immutable Record
   - Verwendung: @Embedded in Tisch oder als JSON

### Schema-Migration (Liquibase)

10. **Liquibase Changesets** werden automatisch generiert (z.B. via Diff-Tool) und committiert
11. Changesets liegen in `src/main/resources/db/changelog/`
12. Master-Changelog: `db.changelog-master.yaml`
13. Format: YAML oder XML (YAML bevorzugt für Lesbarkeit)

### Datenbankprofile

14. **Entwicklung**: H2 In-Memory-Datenbank + Liquibase Migration bei Start
15. **Produktion**: PostgreSQL + Liquibase Migration

### Allgemein

16. Alle Aggregate Roots verwenden **UUIDs** als Primärschlüssel (Java `UUID`, DB `UUID` oder `CHAR(36)`)
17. Timestamps (`erstelltAm`, `aktualisiertAm`) über Lombok `@CreationTimestamp` / `@UpdateTimestamp` oder DB-Default
18. Foreign Keys zwischen Aggregates (lose Kopplung): `tischId`, `spielerId`, `partieId`
19. Kaskadierende Löschung: Database-Level CASCADE wo sinnvoll (z.B. Partie → Spiele → Stiche)
20. Karten einer Hand: **JSON-Feld** (Array von `{farbe, wert}`) — einfacher als Join-Table

## Akzeptanzkriterien

- Alle Aggregate Roots und Entities werden korrekt in der Datenbank angelegt (H2 und PostgreSQL)
- Liquibase Changesets existieren und werden erfolgreich ausgeführt
- Foreign Keys zwischen Aggregates sind korrekt modelliert
- CRUD-Operationen funktionieren für alle Aggregate Roots
- UUIDs werden korrekt als Primärschlüssel verwendet
- Timestamps werden automatisch gesetzt
- Die H2-Konsole ist im Dev-Profil erreichbar (für Debugging)
- Value Objects (z.B. `Karte`) sind immutable und existieren nur im Code, nicht als Tabelle

## Definition of Done

- [ ] Alte JPA-Entitäten aus `spielverwaltung/persistenz/` gelöscht
- [ ] Domain-Klassen in Bounded Contexts nach `lobby/`, `partie/`, `karten/`, `session/` verschoben
- [ ] Aggregate Roots mit Spring Data JDBC `@Table` annotiert
- [ ] Repositories (Spring Data JDBC) für alle Aggregate Roots erstellt (`TischRepository`, `PartieRepository`, `SpielerRepository`)
- [ ] Liquibase Changesets generiert und committiert (`db/changelog/*.yaml`)
- [ ] Unit-Tests für Repository-Operationen geschrieben und bestanden
- [ ] H2-Profil funktioniert (In-Memory, Liquibase-Migration)
- [ ] PostgreSQL-Profil konfiguriert
- [ ] Lombok korrekt eingebunden (`@Getter`, `@RequiredArgsConstructor`, `@Value` für VOs)
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Spring Data JDBC** (NICHT JPA): `@Table`, `@Id`, `@MappedCollection` (statt `@OneToMany`)
- **Lombok**: `@Getter`, `@Setter` (nur wo nötig), `@RequiredArgsConstructor`, `@Value` für VOs
- **Liquibase**: Master-Changelog in `db/changelog/db.changelog-master.yaml`
- `application-dev.properties`: H2-Konfiguration + Liquibase aktiviert
- `application.properties`: PostgreSQL-JDBC-URL, User, Passwort + Liquibase aktiviert
- H2-Konsole unter `/h2-console` im Dev-Modus aktivieren
- Keine Lazy Loading / Session-Management wie bei JPA — explizites Laden via Repository
