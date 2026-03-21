package de.locodoko.spiel.partie;

import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spielregeln;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class Ansagen {

    private final List<AnsageEreignis> ereignisse;

    private Ansagen(List<AnsageEreignis> ereignisse) {
        this.ereignisse = List.copyOf(ereignisse);
    }

    public static Ansagen leer() {
        return new Ansagen(List.of());
    }

    public static Ansagen ausEreignissen(List<AnsageEreignis> ereignisse) {
        Objects.requireNonNull(ereignisse, "ereignisse duerfen nicht null sein");
        return new Ansagen(ereignisse);
    }

    public List<AnsageEreignis> ereignisse() {
        return ereignisse;
    }

    public boolean kannAnsagen(
        SpielerPosition spielerPosition,
        Ansage ansage,
        Parteien parteien,
        Spielregeln spielregeln,
        int handkartenAnzahl
    ) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        Objects.requireNonNull(parteien, "parteien duerfen nicht null sein");
        Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
        if (handkartenAnzahl < ansage.mindestkarten(spielregeln)) {
            return false;
        }
        Partei partei = parteien.parteiVon(spielerPosition);
        if (ansage.istGrundansage()) {
            return ansage.grundpartei() == partei && !hatParteiAnsage(partei, ansage, parteien);
        }
        if (!hatGrundansage(partei, parteien)) {
            return false;
        }
        if (hatParteiAnsage(partei, ansage, parteien)) {
            return false;
        }
        Ansage vorherigeStufe = ansage.vorherigeStufe();
        return vorherigeStufe == null || hatParteiAnsage(partei, vorherigeStufe, parteien);
    }

    public Ansagen fuegeHinzu(
        SpielerPosition spielerPosition,
        Ansage ansage,
        Parteien parteien,
        Spielregeln spielregeln,
        int handkartenAnzahl
    ) {
        if (!kannAnsagen(spielerPosition, ansage, parteien, spielregeln, handkartenAnzahl)) {
            throw new IllegalStateException("Die Ansage " + ansage + " ist fuer " + spielerPosition + " aktuell nicht erlaubt");
        }
        List<AnsageEreignis> neueEreignisse = new ArrayList<>(ereignisse);
        neueEreignisse.add(new AnsageEreignis(spielerPosition, ansage));
        return new Ansagen(neueEreignisse);
    }

    public boolean hatParteiAnsage(Partei partei, Ansage ansage, Parteien parteien) {
        Objects.requireNonNull(partei, "partei darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        Objects.requireNonNull(parteien, "parteien duerfen nicht null sein");
        return ereignisse.stream()
            .anyMatch(ereignis -> ereignis.ansage() == ansage && parteien.parteiVon(ereignis.spieler()) == partei);
    }

    public boolean hatGrundansage(Partei partei, Parteien parteien) {
        return hatParteiAnsage(partei, Ansage.grundansageFuer(partei), parteien);
    }

    public boolean offenbartParteiVon(SpielerPosition spielerPosition) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        return ereignisse.stream()
            .anyMatch(ereignis -> ereignis.spieler() == spielerPosition && ereignis.ansage().istGrundansage());
    }
}
