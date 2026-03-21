package de.locodoko.spiel.ki;

import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.partie.Ansage;
import de.locodoko.spiel.partie.VorbehaltAnsage;

import java.util.List;
import java.util.Optional;

public interface KiStrategie {

    VorbehaltAnsage waehleVorbehalt(KiSpielzustand zustand);

    List<Karte> waehleArmutAngebot(KiSpielzustand zustand);

    KiArmutAntwort waehleArmutAntwort(KiSpielzustand zustand);

    Optional<Ansage> waehleAnsage(KiSpielzustand zustand);

    Karte waehleKarte(KiSpielzustand zustand);
}
