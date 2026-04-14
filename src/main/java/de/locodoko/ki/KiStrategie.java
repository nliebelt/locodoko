package de.locodoko.ki;

import de.locodoko.karten.Karte;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.VorbehaltAnsage;

import java.util.List;
import java.util.Optional;

public interface KiStrategie {

    VorbehaltAnsage waehleVorbehalt(KiSpielzustand zustand);

    List<Karte> waehleArmutAngebot(KiSpielzustand zustand);

    KiArmutAntwort waehleArmutAntwort(KiSpielzustand zustand);

    Optional<Ansage> waehleAnsage(KiSpielzustand zustand);

    Karte waehleKarte(KiSpielzustand zustand);
}
