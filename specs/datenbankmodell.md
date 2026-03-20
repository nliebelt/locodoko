# Datenbankmodell

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Noch nicht begonnen                         |
| Priorität      | Hoch                                        |
| Abhängigkeiten | kartendeck.md, spielablauf.md, spieler-session.md, tischkonfiguration.md, punkteberechnung.md |

## Beschreibung

Definition des Datenbankmodells für die persistente Speicherung aller spielrelevanten Daten. Das Modell bildet Tische, Partien, Spiele, Spieler, Hände, Stiche und Konfigurationen ab. Für die Entwicklung wird H2 (In-Memory) verwendet, für die Produktion PostgreSQL.

## Anforderungen

### Entitäten

1. **`Tisch`**
   - Felder: id (UUID), name, status (WARTEND, IM_SPIEL, BEENDET), erstelltVon (Spieler-ID), erstelltAm
   - Beziehung: 1 Tisch → 1 Tischkonfiguration, 1 Tisch → N Spieler (max. 4), 1 Tisch → 1 Partie

2. **`Tischkonfiguration`**
   - Felder: Alle konfigurierbaren Optionen laut `tischkonfiguration.md`
   - Beziehung: 1:1 mit Tisch (als Embeddable oder separate Tabelle)

3. **`Spieler`**
   - Felder: id (UUID), name, sessionId, istKI, erstelltAm
   - Beziehung: 1 Spieler → 1 Tisch (optional)

4. **`Partie`**
   - Felder: id (UUID), tischId, anzahlSpiele, aktuellesSpielNummer, status (LAUFEND, BEENDET)
   - Beziehung: 1 Partie → N Spiele, 1 Partie → 1 Tisch

5. **`Spiel`**
   - Felder: id (UUID), partieId, spielNummer, geberId, spieltyp (NORMAL, SOLO_DAME, SOLO_BUBE, etc.), status, ergebnis
   - Beziehung: 1 Spiel → N Stiche, 1 Spiel → N Hände

6. **`Hand`**
   - Felder: id, spielerId, spielId, karten (als JSON oder separate Tabelle)
   - Repräsentiert die Karten eines Spielers in einem bestimmten Spiel.

7. **`Stich`**
   - Felder: id, spielId, stichNummer, gewinnerId, augen
   - Beziehung: 1 Stich → 4 gespielte Karten (mit Reihenfolge und Spieler-Referenz)

8. **`GespielteKarte`**
   - Felder: id, stichId, spielerId, farbe, wert, position (Reihenfolge im Stich)

### Datenbankprofile

9. **Entwicklung**: H2 In-Memory-Datenbank (automatisches Schema-Erstellen).
10. **Produktion**: PostgreSQL (Schema via Flyway/Liquibase Migration oder JPA auto-ddl).

### Allgemein

11. Alle Entitäten verwenden **UUIDs** als Primärschlüssel.
12. Timestamps (`erstelltAm`, `aktualisiertAm`) werden automatisch gesetzt.
13. Kaskadierende Löschung: Wenn ein Tisch gelöscht wird, werden zugehörige Partien, Spiele und Stiche ebenfalls entfernt.
14. Die Karten einer Hand können als **JSON-Feld** oder als separate **Join-Tabelle** gespeichert werden.

## Akzeptanzkriterien

- Alle Entitäten werden korrekt in der Datenbank angelegt (H2 und PostgreSQL).
- Beziehungen zwischen Entitäten sind korrekt modelliert (Fremdschlüssel).
- CRUD-Operationen funktionieren für alle Entitäten.
- UUIDs werden korrekt als Primärschlüssel verwendet.
- Timestamps werden automatisch gesetzt.
- Die H2-Konsole ist im Dev-Profil erreichbar (für Debugging).
- Das Schema kann über JPA auto-ddl oder Migrations erstellt werden.

## Definition of Done

- [ ] Alle Anforderungen implementiert
- [ ] JPA-Entitäten mit Annotationen erstellt
- [ ] Repositories (Spring Data JPA) für alle Entitäten erstellt
- [ ] Unit-Tests für Repository-Operationen geschrieben und bestanden
- [ ] H2-Profil funktioniert (In-Memory, auto-create)
- [ ] PostgreSQL-Profil konfiguriert
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Übergreifend (Persistenzschicht)
- Spring Data JPA mit `@Entity`, `@Table`, `@ManyToOne`, `@OneToMany` etc.
- `application-dev.properties`: H2-Konfiguration mit `spring.jpa.hibernate.ddl-auto=create-drop`
- `application.properties`: PostgreSQL-Konfiguration
- Repositories als Interfaces (`extends JpaRepository<Entity, UUID>`)
- Karten können als `@ElementCollection` oder als JSON-Typ (`@Type(JsonType.class)` mit Hibernate-Types) gespeichert werden
- Flyway oder Liquibase für Produktions-Migrationen (optional für MVP, sinnvoll langfristig)
