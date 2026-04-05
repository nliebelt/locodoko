# Architektur-Prinzipien (Domain-Driven Design)

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Neue Vorgabe                                |
| Priorität      | Kritisch                                    |
| Abhängigkeiten | datenbankmodell.md                          |

## Beschreibung

Diese Spezifikation ist der architektonische Kompass für die Locodoko-Codebase. Sie stellt sicher, dass Komplexität durch klare Fachlichkeit beherrscht wird und Code für Menschen (und Agents) ohne Rätselraten lesbar bleibt. Wir bauen kein technisches Konstrukt, sondern bilden ein lebendiges Kartenspiel ab.

Status	Finalisierte Vorgabe
Strategie	Pragmatisches DDD (Domain Model = Persistence Model)
Tech-Stack	Spring Boot, Spring Framework, Spring Data JDBC, Liquibase, Lombok

## Anforderungen

### 1. Kern-Struktur & Persistenz

Bounded Contexts (Package-Struktur)
Die Organisation erfolgt nach fachlichen Modulen, nicht nach technischen Layern.

de.locodoko.lobby: Tischverwaltung & Matchmaking.

de.locodoko.partie: Spiellogik, Stiche, Runden.

de.locodoko.session: Spieler-Identität & WebSocket-Infrastruktur.

de.locodoko.karten: Gemeinsame Value Objects (Karten, Regeln).

Persistence-Regeln (Spring Data JDBC)
Kein JPA/Hibernate: Keine Proxies, kein Lazy Loading.

Aggregates: @Table Annotation, eigene Repositories pro Root.

UUIDs: Primärschlüssel sind immer UUID.

Foreign Keys: Beziehungen zwischen Aggregaten erfolgen ausschließlich über die ID (UUID).

### 2. Domain Design (Entities & VOs)

Aggregate Roots (Mutable)
Identität & Concurrency: Stabile ID; @Version Long version für Optimistic Locking.

Events: Erben von AbstractAggregateRoot zur Kommunikation zwischen Contexts.

Kapselung: Interne Entities sind nach außen hin nur über das Root erreichbar.

Value Objects (Immutable)
Definition: Keine Identität (z. B. Karte). @Value sorgt für 100% Immutability.

Side-Effect-Free: Methoden geben immer neue Instanzen zurück.

### 3. Ubiquitous Language & Dokumentation

Fachliche Benennung
Sprach-Synchronität: Der Code nutzt exakt die Begriffe aus den fachlichen Specs (z. B. stechen(), vorbehalt(), fuchs).

Klassendokumentation: Jede Klasse startet zwingend mit einem prägnanten Satz in der Ubiquitous Language, der ihren fachlichen Zweck gemäß den Specs definiert.

Clean Code Prinzipien
Tell, Don't Ask: Logik liegt im Objekt. Business-Methoden (z. B. tisch.starten()) schlagen technische Setter.

Fail Fast: Invarianten werden sofort im Aggregat durch Exceptions geschützt.

### 4. Full-Stack Konsistenz (Frontend)

Prinzipien-Transfer: Die Konzepte (Ubiquitous Language, Immutability bei VOs, Kapselung der Logik) gelten analog für das Frontend.

Modell-Treue: TypeScript-Interfaces und State-Modelle spiegeln die fachlichen Strukturen des Backends, um einen nahtlosen mentalen Kontextwechsel zu ermöglichen.

### 5. Der Code im Fokus

Lesbarkeit: Wir schreiben Code primär für Lesbarkeit. Code muss ohne externe Doku durch seine Struktur und Sprache (Specs = Code) verständlich sein.

Shared Ownership: Jeder ist für die Einhaltung dieser Prinzipien verantwortlich. Komplexität wird durch Einfachheit (KISS) bekämpft, damit das Team (Mensch & KI) sofort handlungsfähig bleibt.

## Definition of Done

- [ ] Klasse beginnt mit fachlichem Einleitungssatz (Ubiquitous Language).
- [ ] Logik liegt im Aggregat (Business-Methoden statt Setter).
- [ ] @Version für Optimistic Locking integriert.
- [ ] Invarianten durch Exceptions geschützt.
- [ ] Kommunikation zwischen Packages via Events.
- [ ] Frontend-Modelle folgen der fachlichen Struktur des Backends.
- [ ] Package-Struktur nach Bounded Contexts struktiert
- [ ] Aggregate Roots mit `@Table` annotiert
- [ ] Value Objects mit `@Value` annotiert
- [ ] Alte `*Entity.java`-Klassen gelöscht
- [ ] Spring Data JDBC Repositories erstellt
- [ ] Liquibase Changesets generiert
- [ ] Services arbeiten mit neuen Repositories
- [ ] Tests angepasst und grün
- [ ] Code-Review / Plausibilitätsprüfung
