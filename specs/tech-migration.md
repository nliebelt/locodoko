# Migration auf Spring Data JDBC + Liquibase + Java 25 + Spring Boot 4.x

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Neue Vorgabe                                |
| Priorität      | Kritisch (Blocker für weitere Entwicklung) |
| Abhängigkeiten | architektur-ddd.md, datenbankmodell.md      |

## Beschreibung

Migration der Persistence-Schicht von Spring Data JPA (Hibernate) auf Spring Data JDBC + Liquibase. Gleichzeitig Upgrade auf Java 25 und Spring Boot 4.x (latest).

## Anforderungen

### 1. Maven Dependencies (`pom.xml`)

#### Entfernen:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

#### Hinzufügen:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jdbc</artifactId>
</dependency>
<dependency>
    <groupId>org.liquibase</groupId>
    <artifactId>liquibase-core</artifactId>
</dependency>
```

#### Lombok (bereits vorhanden, prüfen):
```xml
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>
```

Alle Lombok Features nutzen

#### Bestehend beibehalten:
- `spring-boot-starter-web`
- `spring-boot-starter-validation`
- `spring-boot-starter-websocket`
- `h2` (runtime)
- `postgresql` (runtime)
- `spring-boot-starter-test`

### 2. Spring Boot Parent Version

**Aktuell**: `3.4.4`  
**Neu**: `4.x` (latest stable, z.B. `4.0.0` falls verfügbar im März 2026)

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.0.0</version> <!-- oder latest 4.x -->
    <relativePath/>
</parent>
```

### 3. Java Version

**Aktuell**: `21`  
**Neu**: `25`

```xml
<properties>
    <java.version>25</java.version>
</properties>
```

### 4. Application Properties

#### `application-dev.properties` (H2 + Liquibase)

**Aktuell (JPA)**:
```properties
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=true
```

**Neu (JDBC + Liquibase)**:
```properties
# H2 Database
spring.datasource.url=jdbc:h2:mem:locodoko
spring.datasource.driverClassName=org.h2.Driver
spring.h2.console.enabled=true

# Liquibase
spring.liquibase.enabled=true
spring.liquibase.change-log=classpath:db/changelog/db.changelog-master.yaml
spring.liquibase.drop-first=true

# Logging
logging.level.liquibase=INFO
```

#### `application.properties` (PostgreSQL + Liquibase)

**Neu**:
```properties
# PostgreSQL Database
spring.datasource.url=jdbc:postgresql://localhost:5432/locodoko
spring.datasource.username=locodoko
spring.datasource.password=locodoko

# Liquibase
spring.liquibase.enabled=true
spring.liquibase.change-log=classpath:db/changelog/db.changelog-master.yaml

# Logging
logging.level.org.springframework.jdbc.core=DEBUG
```

### 5. Liquibase Changelog-Struktur

**Verzeichnis**: `src/main/resources/db/changelog/`

**Master-Changelog**: `db.changelog-master.yaml`

```yaml
databaseChangeLog:
  - include:
      file: db/changelog/001-create-spieler.yaml
  - include:
      file: db/changelog/002-create-tisch.yaml
  - include:
      file: db/changelog/003-create-partie.yaml
  - include:
      file: db/changelog/004-create-spiel.yaml
  - include:
      file: db/changelog/005-create-stich.yaml
```

**Changesets**: Automatisch generiert (z.B. via Liquibase Gradle/Maven Plugin Diff-Tool) oder manuell erstellt.

**Beispiel**: `001-create-spieler.yaml`
```yaml
databaseChangeLog:
  - changeSet:
      id: 001-create-spieler
      author: locodoko
      changes:
        - createTable:
            tableName: spieler
            columns:
              - column:
                  name: id
                  type: UUID
                  constraints:
                    primaryKey: true
                    nullable: false
              - column:
                  name: name
                  type: VARCHAR(255)
                  constraints:
                    nullable: false
              - column:
                  name: session_id
                  type: VARCHAR(255)
              - column:
                  name: ist_ki
                  type: BOOLEAN
                  defaultValue: false
              - column:
                  name: erstellt_am
                  type: TIMESTAMP
                  defaultValueComputed: CURRENT_TIMESTAMP
```

### 6. Code-Änderungen

#### Annotations (Spring Data JDBC)

**Vorher (JPA)**:
```java
@Entity
@Table(name = "tisch")
public class TischEntity { ... }
```

**Nachher (JDBC)**:
```java
@Table("tisch")
public class Tisch { ... }
```

#### Repositories

**Vorher (JPA)**:
```java
public interface TischRepository extends JpaRepository<TischEntity, UUID> { ... }
```

**Nachher (JDBC)**:
```java
public interface TischRepository extends CrudRepository<Tisch, UUID> { ... }
```

#### Beziehungen

**Vorher (JPA)**:
```java
@OneToMany(mappedBy = "partie", cascade = CascadeType.ALL)
private List<SpielEntity> spiele;
```

**Nachher (JDBC)**:
- Foreign Key in `spiel`-Tabelle: `partie_id UUID`
- Laden via Repository: `spielRepository.findByPartieId(partieId)`

### 7. Test-Anpassungen

- `@DataJpaTest` → `@DataJdbcTest`
- `@Transactional` bleibt bestehen
- Test-Daten: Via Liquibase-Test-Changesets oder in `@BeforeEach`

## Akzeptanzkriterien

- `pom.xml` enthält `spring-boot-starter-data-jdbc` und `liquibase-core`, NICHT `data-jpa`
- Spring Boot Parent Version ist `4.x` (latest)
- Java Version ist `25`
- Liquibase-Changesets sind committiert und funktionieren
- H2-Profil: Liquibase erstellt Schema bei Start (`drop-first=true`)
- PostgreSQL-Profil: Liquibase migriert inkrementell
- Alle Tests sind grün (angepasst auf JDBC)
- Keine JPA-Annotationen (`@Entity`, `@OneToMany`) im Code

## Definition of Done

- [ ] `pom.xml` aktualisiert (Spring Boot 4.x, Java 25, JDBC statt JPA, Liquibase)
- [ ] `application-dev.properties` konfiguriert (H2 + Liquibase)
- [ ] `application.properties` konfiguriert (PostgreSQL + Liquibase)
- [ ] Liquibase Master-Changelog erstellt (`db.changelog-master.yaml`)
- [ ] Liquibase Changesets für alle Tabellen erstellt
- [ ] Domain-Klassen mit `@Table` statt `@Entity` annotiert
- [ ] Repositories von `JpaRepository` auf `CrudRepository` umgestellt
- [ ] Tests angepasst (`@DataJdbcTest`)
- [ ] Anwendung startet erfolgreich (H2 + PostgreSQL)
- [ ] Alle Tests grün
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Spring Boot 4.x**: Falls noch nicht released, verwende `4.0.0-SNAPSHOT` oder bleibe bei `3.x` (dann Java 25 Kompatibilität prüfen)
- **Java 25**: Stelle sicher, dass Maven Compiler Plugin Java 25 unterstützt
- **Liquibase Diff**: `mvn liquibase:diff` kann Changesets aus bestehendem Schema generieren
- **H2 UUID Support**: H2 unterstützt nativen `UUID`-Typ ab Version 2.x
- **PostgreSQL UUID**: PostgreSQL hat nativen `UUID`-Typ, verwenden
- **Lombok**: Annotationen `@Value`, `@Getter`, `@RequiredArgsConstructor` für DDD-Patterns
