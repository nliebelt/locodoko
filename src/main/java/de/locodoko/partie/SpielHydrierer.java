package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Rekonstruiert die nicht persistierten Hilfsfelder eines {@link Spiel}. */
class SpielHydrierer {

    static void hydriere(Spiel spiel, Spielregeln spielregeln, SpielerPosition solistDesLetztenSpiels) {
        spiel.spielregeln = Objects.requireNonNull(spielregeln, "spielregeln darf nicht null sein");
        if (spiel.solistAufspieler == null) {
            spiel.solistAufspieler = solistDesLetztenSpiels;
        }
        spiel.synchronisierePersistenzFelder();
    }

    static Optional<VorbehaltMeldung> hoechsterVorbehaltAusListe(List<VorbehaltMeldung> vorbehalte) {
        VorbehaltMeldung best = null;
        for (VorbehaltMeldung meldung : vorbehalte) {
            if (!meldung.istVorbehalt()) continue;
            if (best == null || meldung.ansage().prioritaet() > best.ansage().prioritaet()) best = meldung;
        }
        return Optional.ofNullable(best);
    }

    static Karte alsKarte(HandKarteEmbeddable karte) { return new Karte(karte.farbe(), karte.wert(), karte.exemplarIndex()); }
    static Karte alsKarte(AktuellerStichKarteEmbeddable karte) { return new Karte(karte.farbe(), karte.wert(), karte.exemplarIndex()); }
    static GespielteKarte alsGespielteKarte(AktuellerStichKarteEmbeddable karte) { return new GespielteKarte(karte.spielerPosition(), alsKarte(karte), karte.reihenfolge()); }
    static Stich alsStich(StichJsonEintrag eintrag) { return Stich.ausPersistiertemStand(eintrag.aufspielerPosition(), eintrag.gespielteKarten().stream().map(SpielHydrierer::alsGespielteKarte).toList()); }
    static boolean istKreuzDame(Karte karte) { return karte.farbe() == Farbe.KREUZ && karte.wert() == Kartenwert.DAME; }
}
