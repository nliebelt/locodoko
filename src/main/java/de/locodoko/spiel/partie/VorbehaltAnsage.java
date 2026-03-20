package de.locodoko.spiel.partie;

import de.locodoko.spiel.karten.Farbe;
import de.locodoko.spiel.karten.Hand;
import de.locodoko.spiel.karten.Kartenwert;
import de.locodoko.spiel.karten.NormaleTrumpfOrdnung;
import de.locodoko.spiel.karten.Spielregeln;
import de.locodoko.spiel.karten.Spieltyp;

import java.util.Objects;
import java.util.Optional;

public enum VorbehaltAnsage {
    GESUND(null, 0) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            return true;
        }
    },
    SOLO_TRUMPF(Spieltyp.SOLO_TRUMPF, 3) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            return spielregeln.soloTrumpfAktiv();
        }
    },
    HOCHZEIT(Spieltyp.HOCHZEIT, 2) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            long anzahlKreuzDamen = hand.karten().stream()
                .filter(karte -> karte.farbe() == Farbe.KREUZ && karte.wert() == Kartenwert.DAME)
                .count();
            return spielregeln.hochzeitAktiv() && anzahlKreuzDamen == 2;
        }
    },
    ARMUT(Spieltyp.ARMUT, 1) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            NormaleTrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(spielregeln);
            long anzahlTruepfe = hand.karten().stream().filter(trumpfOrdnung::istTrumpf).count();
            return spielregeln.armutAktiv() && anzahlTruepfe <= 3;
        }
    };

    private final Spieltyp spieltyp;
    private final int prioritaet;

    VorbehaltAnsage(Spieltyp spieltyp, int prioritaet) {
        this.spieltyp = spieltyp;
        this.prioritaet = prioritaet;
    }

    public boolean istGesund() {
        return this == GESUND;
    }

    public int prioritaet() {
        return prioritaet;
    }

    public Optional<Spieltyp> spieltyp() {
        return Optional.ofNullable(spieltyp);
    }

    public abstract boolean istZulaessig(Hand hand, Spielregeln spielregeln);
}
