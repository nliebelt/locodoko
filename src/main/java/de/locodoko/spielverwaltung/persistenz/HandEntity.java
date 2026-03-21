package de.locodoko.spielverwaltung.persistenz;

import com.fasterxml.jackson.core.type.TypeReference;
import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.SpielerPosition;
import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.List;
import java.util.Objects;

/**
 * Persistenz-Entity fuer die Hand eines Spielers in einem Spiel.
 * Owned by SpielEntity via @MappedCollection (Map nach spieler_position).
 * Die Karten werden als JSON-Text in der Spalte 'karten' gespeichert.
 *
 * Hinweis: spieler_position ist NICHT als @Column gemappt, da der @MappedCollection
 * keyColumn in SpielEntity den Wert in die Spalte schreibt. Fuer direkte Queries
 * (z.B. HandRepository) wird spieler_position per SQL-Parameter uebergeben.
 * Das Feld spielerPositionStr wird nach dem Laden aus dem Map-Key gesetzt.
 */
@Table("hand")
public class HandEntity extends AbstraktePersistenzEntity {

    /**
     * Spielerposition der Hand (transient).
     * Wird nach dem Laden durch SpielEntity aus dem Map-Key befuellt,
     * oder direkt durch Konstruktor gesetzt.
     */
    @Transient
    private String spielerPositionStr;

    /** Karten als JSON-Text gespeichert (Liste von HandKarteEmbeddable). */
    @Column("karten")
    private String kartenJson;

    /** Rueckreferenz auf das Spiel (transient, wird in-memory gesetzt). */
    @Transient
    private SpielEntity spiel;

    protected HandEntity() {
    }

    private HandEntity(SpielerPosition spielerPosition, List<HandKarteEmbeddable> karten) {
        this.spielerPositionStr = Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein").name();
        this.kartenJson = JsonKonverter.schreibeAlsJson(karten);
    }

    public static HandEntity neu(SpielerPosition spielerPosition, List<Karte> karten) {
        return new HandEntity(
            spielerPosition,
            karten.stream().map(HandKarteEmbeddable::aus).toList()
        );
    }

    public void ersetzeKarten(List<Karte> neueKarten) {
        Objects.requireNonNull(neueKarten, "neueKarten duerfen nicht null sein");
        this.kartenJson = JsonKonverter.schreibeAlsJson(
            neueKarten.stream().map(HandKarteEmbeddable::aus).toList()
        );
    }

    void setzeSpiel(SpielEntity spiel) {
        this.spiel = spiel;
    }

    /** Setzt die SpielerPosition (wird nach dem Laden aus dem Map-Key gesetzt). */
    void setzeSpielerPosition(String spielerPositionStr) {
        this.spielerPositionStr = spielerPositionStr;
    }

    public SpielEntity spiel() {
        return spiel;
    }

    public SpielerPosition spielerPosition() {
        return SpielerPosition.valueOf(spielerPositionStr);
    }

    public List<HandKarteEmbeddable> karten() {
        return JsonKonverter.liesList(kartenJson, new TypeReference<List<HandKarteEmbeddable>>() {});
    }
}
