package de.locodoko.partie.ki;

import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Stich;
import de.locodoko.karten.TrumpfOrdnung;
import de.locodoko.karten.Spieltyp;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Ansagen;
import de.locodoko.partie.ArmutStatus;
import de.locodoko.partie.HochzeitStatus;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.VorbehaltAnsage;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

public record KiSpielzustand(
    SpielerPosition spielerPosition,
    Spieltyp spieltyp,
    Spielphase phase,
    Spielregeln spielregeln,
    TrumpfOrdnung trumpfOrdnung,
    Hand eigeneHand,
    Parteien parteien,
    Ansagen ansagen,
    List<Stich> abgeschlosseneStiche,
    Stich aktuellerStich,
    ArmutStatus armutStatus,
    HochzeitStatus hochzeitStatus,
    List<Karte> gueltigeKarten,
    List<Ansage> moeglicheAnsagen,
    List<VorbehaltAnsage> moeglicheVorbehalte
) {

    public KiSpielzustand {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein");
        Objects.requireNonNull(phase, "phase darf nicht null sein");
        Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
        Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        Objects.requireNonNull(eigeneHand, "eigeneHand darf nicht null sein");
        Objects.requireNonNull(ansagen, "ansagen duerfen nicht null sein");
        abgeschlosseneStiche = List.copyOf(abgeschlosseneStiche);
        gueltigeKarten = List.copyOf(gueltigeKarten);
        moeglicheAnsagen = List.copyOf(moeglicheAnsagen);
        moeglicheVorbehalte = List.copyOf(moeglicheVorbehalte);
    }

    public static KiSpielzustand aus(Spiel spiel, SpielerPosition spielerPosition) {
        Objects.requireNonNull(spiel, "spiel darf nicht null sein");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        return new KiSpielzustand(
            spielerPosition,
            spiel.spieltyp(),
            spiel.phase(),
            spiel.spielregeln(),
            spiel.trumpfOrdnung(),
            spiel.handVon(spielerPosition),
            spiel.phase() == Spielphase.VORBEHALT_ANSAGE ? null : spiel.parteien(),
            spiel.ansagen(),
            spiel.abgeschlosseneStiche(),
            spiel.aktuellerStich().orElse(null),
            spiel.armutStatus().orElse(null),
            spiel.hochzeitStatus().orElse(null),
            spiel.erwarteterSpieler().filter(spielerPosition::equals).isPresent() && spiel.phase() == Spielphase.STICHPHASE
                ? spiel.gueltigeKartenFuer(spielerPosition)
                : List.of(),
            List.of(Ansage.values()).stream().filter(ansage -> spiel.kannAnsagen(spielerPosition, ansage)).toList(),
            List.of(VorbehaltAnsage.values()).stream()
                .filter(ansage -> ansage.istZulaessig(spiel.handVon(spielerPosition), spiel.spielregeln()))
                .toList()
        );
    }

    public Optional<Partei> eigenePartei() {
        if (parteien == null) {
            return Optional.empty();
        }
        return Optional.of(parteien.parteiVon(spielerPosition));
    }

    public Optional<Partei> sichtbareParteiVon(SpielerPosition zielPosition) {
        Objects.requireNonNull(zielPosition, "zielPosition darf nicht null sein");
        if (parteien == null) {
            return Optional.empty();
        }
        return parteien.sichtAufPartei(spielerPosition, zielPosition)
            .or(() -> ansagen.offenbartParteiVon(zielPosition)
                ? Optional.of(parteien.parteiVon(zielPosition))
                : Optional.empty());
    }
}
