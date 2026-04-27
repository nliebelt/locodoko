package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;

import java.util.Objects;
import java.util.Optional;

/**
 * Moegliche Vorbehalte, die ein Spieler in der Vorbehalt-Ansage-Phase melden kann.
 *
 * <p>Jeder Spieler meldet entweder {@code GESUND} (kein Vorbehalt) oder einen Vorbehalt
 * (Schmeissen, Soli, Hochzeit, Armut). Prioritaeten: Schmeissen (4) > Soli (3) > Hochzeit (2) >
 * Armut (1) > Gesund (0). Bei mehreren Soli entscheidet die fruehere Sitzposition. Die Methode
 * {@link #istZulaessig(Hand, Spielregeln)} prueft, ob der Vorbehalt mit der aktuellen Hand
 * und Tischkonfiguration erlaubt ist.</p>
 */
public enum VorbehaltAnsage {
    GESUND(null, 0) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            return true;
        }
    },
    SOLO_DAME(Spieltyp.SOLO_DAME, 3) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            return spielregeln.soloDameAktiv();
        }
    },
    SOLO_BUBE(Spieltyp.SOLO_BUBE, 3) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            return spielregeln.soloBubeAktiv();
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
    SOLO_TRUMPF_HERZ(Spieltyp.SOLO_TRUMPF_HERZ, 3) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            return spielregeln.soloTrumpfAktiv();
        }
    },
    SOLO_TRUMPF_PIK(Spieltyp.SOLO_TRUMPF_PIK, 3) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            return spielregeln.soloTrumpfAktiv();
        }
    },
    SOLO_TRUMPF_KREUZ(Spieltyp.SOLO_TRUMPF_KREUZ, 3) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            return spielregeln.soloTrumpfAktiv();
        }
    },
    SOLO_FLEISCHLOS(Spieltyp.SOLO_FLEISCHLOS, 3) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            return spielregeln.soloFleischlosAktiv();
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
    },
    /** Schmeissen bei 5 oder mehr Koenigen. Hoechste Prioritaet — fuehrt zu sofortigem Neu-Austeilen. */
    SCHMEISSEN(null, 4) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            long anzahlKoenige = hand.karten().stream()
                .filter(karte -> karte.wert() == Kartenwert.KOENIG)
                .count();
            return spielregeln.schmeissenAktiv() && anzahlKoenige >= 5;
        }
    },
    /** Schmeissen bei 5 oder mehr Neunen. Hoechste Prioritaet — fuehrt zu sofortigem Neu-Austeilen. */
    SCHMEISSEN_FUENF_NEUNEN(null, 4) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            long anzahlNeunen = hand.karten().stream()
                .filter(karte -> karte.wert() == Kartenwert.NEUN)
                .count();
            return spielregeln.schmeissenAktiv() && anzahlNeunen >= 5;
        }
    },
    /** Schmeissen bei weniger als 2 Truempfen. Hoechste Prioritaet — fuehrt zu sofortigem Neu-Austeilen. */
    SCHMEISSEN_WENIG_TRUMPF(null, 4) {
        @Override
        public boolean istZulaessig(Hand hand, Spielregeln spielregeln) {
            Objects.requireNonNull(hand, "hand darf nicht null sein");
            Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
            NormaleTrumpfOrdnung trumpfOrdnung = new NormaleTrumpfOrdnung(spielregeln);
            long anzahlTruepfe = hand.karten().stream().filter(trumpfOrdnung::istTrumpf).count();
            return spielregeln.schmeissenAktiv() && anzahlTruepfe < 2;
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

    public boolean istSchmeissen() {
        return this == SCHMEISSEN || this == SCHMEISSEN_FUENF_NEUNEN || this == SCHMEISSEN_WENIG_TRUMPF;
    }

    public int prioritaet() {
        return prioritaet;
    }

    public Optional<Spieltyp> spieltyp() {
        return Optional.ofNullable(spieltyp);
    }

    public abstract boolean istZulaessig(Hand hand, Spielregeln spielregeln);
}
