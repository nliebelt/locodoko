# Architektur-Prinzipien (Domain-Driven Design)

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Neue Vorgabe                                |
| Priorität      | Kritisch                                    |
| Abhängigkeiten | datenbankmodell.md                          |

## Beschreibung

Diese Specification definiert die architektonischen Prinzipien und strukturellen Vorgaben für die Locodoko-Codebase. Es handelt sich um **pragmatisches DDD** mit **Domain Model = Persistence Model** (Option A aus DDD-Patterns).

## Anforderungen

### 1. Domain Model = Persistence Model

- **Keine Trennung** zwischen Domain-Objekten und Persistence-Objekten
- Domain-Klassen werden **direkt** mit Spring Data JDBC `@Table` annotiert
- **Vorteil**: Weniger Mapping-Code, direkter und wartbar
- **Trade-off**: Domain-Objekte werden nicht vollständig immutable

### 2. Aggregate Roots vs. Value Objects

#### Aggregate Roots (mutable)

- **Definition**: Entitäten mit eigener Identität (UUID) und eigenem Lebenszyklus
- **Persistierung**: Eigene Tabelle mit `@Table`-Annotation
- **Mutability**: Mutable, aber Änderungen **nur** über kontrollierte Business-Methoden
- **Lombok**: `@Getter`, `@Setter` (private/package-private), `@RequiredArgsConstructor`
- **Beispiele**: `Tisch`, `Partie`, `Spieler`, `Spiel`

```java
@Table("tisch")
@Getter
@RequiredArgsConstructor
public class Tisch {
    @Id
    private final UUID id;
    private String name;
    private TischStatus status;
    
    // Business-Methode statt direktem Setter
    public void starten() {
        if (this.status != TischStatus.WARTEND) {
            throw new IllegalStateException("Tisch kann nicht gestartet werden");
        }
        this.status = TischStatus.IM_SPIEL;
    }
}
```

#### Value Objects (immutable)

- **Definition**: Objekte ohne eigene Identität, definiert durch ihre Attribute
- **Persistierung**: KEINE eigene Tabelle, nur in Code
- **Mutability**: Vollständig immutable (alle Felder `final`)
- **Lombok**: `@Value` (generiert `final`, `@Getter`, `equals()`, `hashCode()`)
- **Verwendung**: Als Felder in Aggregates, als JSON-Werte, als Enums
- **Beispiele**: `Karte`, `Spielregeln`, `Stich`, `Hand`, `Ansage`

```java
@Value
public class Karte {
    Farbe farbe;
    Kartenwert wert;
    
    // Lombok generiert: final fields, getter, equals, hashCode, toString
}
```

### 3. Package-Struktur (Bounded Contexts)

Die Codebase ist nach **Bounded Contexts** organisiert (nicht nach Layer):

```
de.locodoko/
├── LocodokoAnwendung.java
├── lobby/                  # Tisch erstellen, beitreten, Listen
│   ├── Tisch.java          # Aggregate Root (@Table)
│   ├── TischRepository.java
│   ├── TischService.java
│   └── TischController.java
│
├── partie/                 # Partie, Spiel, Stiche
│   ├── Partie.java         # Aggregate Root (@Table)
│   ├── Spiel.java          # Entity innerhalb Partie
│   ├── Stich.java          # Value Object
│   ├── PartieRepository.java
│   └── PartieService.java
│
├── karten/                 # Kartendeck, Value Objects
│   ├── Karte.java          # Value Object
│   ├── Kartendeck.java     # Value Object
│   ├── Farbe.java          # Enum
│   ├── Kartenwert.java     # Enum
│   ├── TrumpfOrdnung.java  # Value Object
│   └── Spielregeln.java    # Value Object
│
└── session/                # Spieler, WebSocket
    ├── Spieler.java        # Aggregate Root (@Table)
    ├── SpielerRepository.java
    ├── SpielerService.java
    └── WebSocketConfiguration.java
```

**Regeln**:
- Jeder Bounded Context ist ein **eigenes Package**
- Controller, Service, Repository **im selben Package** wie das Aggregate
- Value Objects (z.B. `Karte`) dürfen **überall** verwendet werden
- Domain-Klassen importieren **keine** Infrastructure (z.B. keine WebSocket-Klassen)

### 4. Aggregate Boundaries (Foreign Keys)

Jedes Aggregate Root hat einen **eigenen Repository** und **eigenen Lebenszyklus**.

**Beziehungen zwischen Aggregates**:
- Via **Foreign Key** (UUID-Referenz), nicht via Object-Graph
- Laden: Explizit über Repository (kein Lazy Loading wie bei JPA)

**Beispiel**:
```java
@Table("partie")
public class Partie {
    @Id
    private UUID id;
    private UUID tischId;  // Foreign Key → Tisch (anderes Aggregate)
    // NICHT: private Tisch tisch;  ← Das wäre ein Object-Graph
}
```

**Warum?**
- Keine kaskadierenden Lazy-Loading-Probleme
- Klare Transaktionsgrenzen
- Einfachere Tests (keine komplexen Mocks)

### 5. Spring Data JDBC (nicht JPA)

**Tech Stack**:
- `spring-boot-starter-data-jdbc` (NICHT `spring-boot-starter-data-jpa`)
- `@Table`, `@Id`, `@MappedCollection` (NICHT `@Entity`, `@OneToMany`, `@ManyToOne`)
- Liquibase für Schema-Migration

**Vorteile**:
- Einfacher, weniger "Magie" als JPA/Hibernate
- Kein Session-Management, kein Lazy Loading
- Explizite Kontrolle über Queries
- Besser für DDD (Aggregate-orientiert)

**Beispiel-Repository**:
```java
public interface TischRepository extends CrudRepository<Tisch, UUID> {
    List<Tisch> findByStatus(TischStatus status);
}
```

### 6. Liquibase für Schema-Migration

**Changesets**:
- Automatisch generiert (z.B. via Liquibase Diff-Tool)
- Versioniert in Git: `src/main/resources/db/changelog/`
- Format: **YAML** (lesbar, Git-freundlich)

**Master-Changelog**: `db/changelog/db.changelog-master.yaml`

**Beispiel**:
```yaml
databaseChangeLog:
  - include:
      file: db/changelog/001-create-tisch.yaml
  - include:
      file: db/changelog/002-create-partie.yaml
```

**Profile**:
- **Dev** (H2): Liquibase läuft bei Start, clean slate
- **Prod** (PostgreSQL): Liquibase prüft Migrationen, führt nur neue aus

### 7. Lombok für Boilerplate-Reduktion

**Aggregate Roots**:
- `@Getter` — alle Felder lesbar
- `@RequiredArgsConstructor` — Konstruktor für `final`-Felder
- `@Setter` (private) — nur wo nötig, bevorzuge Business-Methoden

**Value Objects**:
- `@Value` — macht alles `final`, generiert Getter, `equals()`, `hashCode()`, `toString()`

**Beispiel**:
```java
@Value
public class Spielregeln {
    boolean mitNeunen;
    boolean dubleDulleSticht;
    int maxVorbehalte;
    // Lombok generiert: final fields, getters, equals, hashCode
}
```

### 8. Migration: Big Bang (Clean Slate)

**Strategie**: Alles auf einmal neu strukturieren (wie Peter Fox: "Alles neu!")

**Schritte**:
1. ❌ **Löschen**: `src/main/java/de/locodoko/spielverwaltung/persistenz/*Entity.java`
2. ✅ **Verschieben**: Domain-Klassen aus `spiel/` nach Bounded Contexts (`lobby/`, `partie/`, etc.)
3. ✅ **Annotieren**: Aggregate Roots mit `@Table`, Value Objects mit `@Value`
4. ✅ **Repositories**: Neue JDBC-Repositories erstellen
5. ✅ **Liquibase**: Changesets generieren
6. ✅ **Tests**: Anpassen und grün machen

**Warum Big Bang?**
- Klarer Cut, kein hybrider Zustand
- Tests zeigen sofort, was fehlt
- Schneller als inkrementell bei kleiner Codebase

## Akzeptanzkriterien

- Alle Domain-Klassen sind nach Bounded Contexts organisiert
- Aggregate Roots haben `@Table`, Value Objects haben `@Value`
- Keine `spielverwaltung/persistenz/`-Klassen mehr vorhanden
- Spring Data JDBC Repositories funktionieren für alle Aggregate Roots
- Liquibase-Changesets sind committiert und lauffähig
- Tests sind grün (angepasst auf neue Struktur)
- Foreign Keys zwischen Aggregates funktionieren

## Definition of Done

- [ ] Package-Struktur nach Bounded Contexts umgebaut
- [ ] Aggregate Roots mit `@Table` annotiert
- [ ] Value Objects mit `@Value` annotiert
- [ ] Alte `*Entity.java`-Klassen gelöscht
- [ ] Spring Data JDBC Repositories erstellt
- [ ] Liquibase Changesets generiert
- [ ] Services arbeiten mit neuen Repositories
- [ ] Tests angepasst und grün
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Lombok Dependency**: Bereits in `pom.xml` vorhanden
- **Spring Data JDBC**: `pom.xml` ändern von `data-jpa` zu `data-jdbc`
- **Liquibase**: Dependency in `pom.xml` hinzufügen
- **H2**: Dialect für Liquibase konfigurieren
- **PostgreSQL**: JDBC-Driver bereits vorhanden
