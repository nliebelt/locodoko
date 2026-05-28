package de.locodoko.partie;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import java.util.Objects;
import java.util.Set;

/**
 * Phase innerhalb eines einzelnen Doppelkopf-Spiels als Zustandsobjekt (State Pattern).
 *
 * <p>Jede Phase ist ein eigener Record-Typ, der nur die fuer diese Phase relevanten
 * Zustandsfelder enthaelt. Phasenwechsel erzeugen neue Instanzen — das Spiel-Objekt
 * bleibt unveraenderlich.</p>
 *
 * <p>Die Phasen laufen sequenziell ab: Karten austeilen → Vorbehalt ansagen →
 * Vorbehalt aufloesen (optional: Armut-Tausch) → Stichphase → Auswertung →
 * Gesamtstand aktualisieren.</p>
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "typ")
@JsonSubTypes({
    @JsonSubTypes.Type(value = Spielphase.KartenAusteilen.class,          name = "KARTEN_AUSTEILEN"),
    @JsonSubTypes.Type(value = Spielphase.VorbehaltAnsage.class,          name = "VORBEHALT_ANSAGE"),
    @JsonSubTypes.Type(value = Spielphase.VorbehaltAufloesung.class,      name = "VORBEHALT_AUFLOESUNG"),
    @JsonSubTypes.Type(value = Spielphase.ArmutTausch.class,              name = "ARMUT_TAUSCH"),
    @JsonSubTypes.Type(value = Spielphase.Stichphase.class,               name = "STICHPHASE"),
    @JsonSubTypes.Type(value = Spielphase.Auswertung.class,               name = "AUSWERTUNG"),
    @JsonSubTypes.Type(value = Spielphase.GesamtstandAktualisieren.class, name = "GESAMTSTAND_AKTUALISIEREN")
})
public sealed interface Spielphase {

    /** Phasenname fuer Persistenz und API-Serialisierung (kompatibel zur alten Enum-Benennung). */
    default String name() {
        return switch (this) {
            case KartenAusteilen _ -> "KARTEN_AUSTEILEN";
            case VorbehaltAnsage _ -> "VORBEHALT_ANSAGE";
            case VorbehaltAufloesung _ -> "VORBEHALT_AUFLOESUNG";
            case ArmutTausch _ -> "ARMUT_TAUSCH";
            case Stichphase _ -> "STICHPHASE";
            case Auswertung _ -> "AUSWERTUNG";
            case GesamtstandAktualisieren _ -> "GESAMTSTAND_AKTUALISIEREN";
        };
    }

    /** Konstanten fuer datenlose Phasen — erlauben {@code Spielphase.KARTEN_AUSTEILEN} etc. */
    KartenAusteilen KARTEN_AUSTEILEN = new KartenAusteilen();
    VorbehaltAnsage VORBEHALT_ANSAGE = new VorbehaltAnsage();
    VorbehaltAufloesung VORBEHALT_AUFLOESUNG = new VorbehaltAufloesung();
    Auswertung AUSWERTUNG = new Auswertung();
    GesamtstandAktualisieren GESAMTSTAND_AKTUALISIEREN = new GesamtstandAktualisieren();

    record KartenAusteilen() implements Spielphase {}
    record VorbehaltAnsage() implements Spielphase {}
    record VorbehaltAufloesung() implements Spielphase {}

    record ArmutTausch(ArmutStatus armutStatus) implements Spielphase {
        public ArmutTausch {
            Objects.requireNonNull(armutStatus, "armutStatus darf nicht null sein");
        }
    }

    record Stichphase(Stich aktuellerStich, Set<Partei> pflichtansageAusstehend, HochzeitStatus hochzeitStatus) implements Spielphase {
        public Stichphase {
            Objects.requireNonNull(aktuellerStich, "aktuellerStich darf in der Stichphase nicht null sein");
            pflichtansageAusstehend = pflichtansageAusstehend == null || pflichtansageAusstehend.isEmpty()
                ? Set.of()
                : Set.copyOf(pflichtansageAusstehend);
        }
    }

    record Auswertung() implements Spielphase {}
    record GesamtstandAktualisieren() implements Spielphase {}
}
