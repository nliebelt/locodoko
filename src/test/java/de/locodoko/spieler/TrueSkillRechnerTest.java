package de.locodoko.spieler;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Unit-Tests fuer {@link TrueSkillRechner}.
 * Verifiziert die Richtung und Groessenordnung der TrueSkill-Updates — faengt
 * falsche Vorzeichen und degenerierte Sigma-Werte ab.
 */
class TrueSkillRechnerTest {

    private static SpielerStatistik neueStatistik() {
        return SpielerStatistik.fuer(UUID.randomUUID(), "TURNIER");
    }

    @Test
    void siegerMuSteigtVerliererMuFaellt() {
        // 2v2 Ausgangspunkt: alle auf Standardwerten
        SpielerStatistik re1 = neueStatistik();
        SpielerStatistik re2 = neueStatistik();
        SpielerStatistik ko1 = neueStatistik();
        SpielerStatistik ko2 = neueStatistik();

        TrueSkillRechner.aktualisiereZweiTeams(List.of(re1, re2), List.of(ko1, ko2));

        // Sieger: mu muss gestiegen sein
        assertThat(re1.ratingMu()).isGreaterThan(TrueSkillRechner.MU_INIT);
        assertThat(re2.ratingMu()).isGreaterThan(TrueSkillRechner.MU_INIT);
        // Verlierer: mu muss gefallen sein
        assertThat(ko1.ratingMu()).isLessThan(TrueSkillRechner.MU_INIT);
        assertThat(ko2.ratingMu()).isLessThan(TrueSkillRechner.MU_INIT);
    }

    @Test
    void sigmaFaelltNachSpiel() {
        SpielerStatistik s = neueStatistik();
        SpielerStatistik gegner = neueStatistik();

        TrueSkillRechner.aktualisiereZweiTeams(List.of(s), List.of(gegner));

        // Sigma sinkt — Unsicherheit ueber Skill nimmt mit jedem Spiel ab
        assertThat(s.ratingSigma()).isLessThan(TrueSkillRechner.SIGMA_INIT);
        assertThat(gegner.ratingSigma()).isLessThan(TrueSkillRechner.SIGMA_INIT);
    }

    @Test
    void symmetrischesSpiel_MuAenderungGleichGross() {
        // Bei gleichen Ausgangsratings: Gewinner gewinnt genau so viel wie Verlierer verliert
        SpielerStatistik sieger = neueStatistik();
        SpielerStatistik verlierer = neueStatistik();

        TrueSkillRechner.aktualisiereZweiTeams(List.of(sieger), List.of(verlierer));

        double gewinn = sieger.ratingMu() - TrueSkillRechner.MU_INIT;
        double verlust = TrueSkillRechner.MU_INIT - verlierer.ratingMu();
        assertThat(gewinn).isCloseTo(verlust, within(1e-9));
    }

    @Test
    void favorit_gewinntNurWenigPunkte() {
        // Klarer Favorit (mu=40) besiegt Anfaenger (mu=10) — kleiner Gewinn fuer Favorit
        SpielerStatistik favorit = neueStatistik();
        favorit.aktualisiereRating(40.0, TrueSkillRechner.SIGMA_INIT);
        SpielerStatistik anfaenger = neueStatistik();
        anfaenger.aktualisiereRating(10.0, TrueSkillRechner.SIGMA_INIT);

        TrueSkillRechner.aktualisiereZweiTeams(List.of(favorit), List.of(anfaenger));

        double gewinnFavorit = favorit.ratingMu() - 40.0;
        // Favorit sollte weniger als 2 Punkte gewinnen (erwartetes Ergebnis)
        assertThat(gewinnFavorit).isGreaterThan(0.0).isLessThan(2.0);
    }

    @Test
    void anfaenger_schlaegt_favorit_grosserGewinn() {
        // Ueberraschungssieg: Anfaenger (mu=10) besiegt Favoriten (mu=40) — grosser Gewinn
        SpielerStatistik anfaenger = neueStatistik();
        anfaenger.aktualisiereRating(10.0, TrueSkillRechner.SIGMA_INIT);
        SpielerStatistik favorit = neueStatistik();
        favorit.aktualisiereRating(40.0, TrueSkillRechner.SIGMA_INIT);

        TrueSkillRechner.aktualisiereZweiTeams(List.of(anfaenger), List.of(favorit));

        double gewinnAnfaenger = anfaenger.ratingMu() - 10.0;
        // Ueberraschungssieg: grosser Mu-Sprung
        assertThat(gewinnAnfaenger).isGreaterThan(2.0);
    }

    @Test
    void standardwerte_korrekt() {
        assertThat(TrueSkillRechner.MU_INIT).isEqualTo(25.0);
        assertThat(TrueSkillRechner.SIGMA_INIT).isCloseTo(25.0 / 3.0, within(1e-9));
        // Neues Statistik-Objekt traegt Standardwerte
        SpielerStatistik s = neueStatistik();
        assertThat(s.ratingMu()).isEqualTo(25.0);
        assertThat(s.ratingSigma()).isCloseTo(25.0 / 3.0, within(1e-9));
        assertThat(s.konservativesRating()).isCloseTo(25.0 - 3.0 * (25.0 / 3.0), within(1e-9)); // ≈ 0
    }

    @Test
    void konservativesRating_entsprichtFormel() {
        SpielerStatistik s = neueStatistik();
        s.aktualisiereRating(30.0, 5.0);
        // 30 - 3*5 = 15
        assertThat(s.konservativesRating()).isCloseTo(15.0, within(1e-9));
    }
}
