package de.locodoko.spieler;

import java.util.List;

/**
 * TrueSkill-Implementierung fuer 2-Team-Spiele ohne Gleichstand (Doppelkopf: Re vs. Kontra).
 * Bayessches Skill-Ranking nach Herbrich et al. — faktorisierter Gaussian-Belief-Propagation.
 *
 * <p>Standardparameter:
 * <ul>
 *   <li>μ₀ = 25.0  (Startwert Skill-Mean)</li>
 *   <li>σ₀ = μ₀/3 ≈ 8.3333 (Startwert Skill-Sigma)</li>
 *   <li>β  = μ₀/6 ≈ 4.1667 (Performance-Rauschen pro Spieler)</li>
 * </ul>
 * </p>
 *
 * <p>Oeffentliches Ranking (Anzeige) = μ − 3σ (konservative Schaetzung).</p>
 */
class TrueSkillRechner {

    static final double MU_INIT = 25.0;
    static final double SIGMA_INIT = MU_INIT / 3.0;
    private static final double BETA = MU_INIT / 6.0;
    private static final double SIGMA_MIN = 0.1;

    private TrueSkillRechner() {}

    /**
     * Aktualisiert die Ratings aller Spieler beider Teams nach einem abgeschlossenen Spiel.
     * Die Methode schreibt die neuen Werte direkt in die uebergebenen {@link SpielerStatistik}-Objekte.
     *
     * @param siegerTeam    Statistiken der Gewinner-Partei
     * @param verliererTeam Statistiken der Verlierer-Partei
     */
    static void aktualisiereZweiTeams(List<? extends TrueSkillTeilnehmer> siegerTeam,
                                       List<? extends TrueSkillTeilnehmer> verliererTeam) {
        double muSieger = siegerTeam.stream().mapToDouble(TrueSkillTeilnehmer::ratingMu).sum();
        double muVerlierer = verliererTeam.stream().mapToDouble(TrueSkillTeilnehmer::ratingMu).sum();

        double c2 = siegerTeam.stream()
                .mapToDouble(s -> s.ratingSigma() * s.ratingSigma() + BETA * BETA)
                .sum()
            + verliererTeam.stream()
                .mapToDouble(s -> s.ratingSigma() * s.ratingSigma() + BETA * BETA)
                .sum();
        double c = Math.sqrt(c2);

        double t = (muSieger - muVerlierer) / c;
        double v = vGewinn(t);
        double w = wGewinn(t, v);

        for (TrueSkillTeilnehmer spieler : siegerTeam) {
            double sigma2 = spieler.ratingSigma() * spieler.ratingSigma();
            double neueMu = spieler.ratingMu() + (sigma2 / c) * v;
            double neueSigma = Math.max(SIGMA_MIN,
                spieler.ratingSigma() * Math.sqrt(Math.max(0.0, 1.0 - (sigma2 / c2) * w)));
            spieler.aktualisiereRating(neueMu, neueSigma);
        }

        for (TrueSkillTeilnehmer spieler : verliererTeam) {
            double sigma2 = spieler.ratingSigma() * spieler.ratingSigma();
            double neueMu = spieler.ratingMu() - (sigma2 / c) * v;
            double neueSigma = Math.max(SIGMA_MIN,
                spieler.ratingSigma() * Math.sqrt(Math.max(0.0, 1.0 - (sigma2 / c2) * w)));
            spieler.aktualisiereRating(neueMu, neueSigma);
        }
    }

    /** v-Faktor fuer Gewinn (kein Gleichstand): φ(t)/Φ(t). */
    private static double vGewinn(double t) {
        double phi = phi(t);
        double Phi = Phi(t);
        return Phi < 1e-10 ? -t : phi / Phi;
    }

    /** w-Faktor fuer Gewinn: v * (v + t). */
    private static double wGewinn(double t, double v) {
        return v * (v + t);
    }

    /** Standard-Normalverteilung PDF. */
    private static double phi(double x) {
        return Math.exp(-0.5 * x * x) / Math.sqrt(2.0 * Math.PI);
    }

    /** Standard-Normalverteilung CDF via erf-Approximation (Abramowitz & Stegun 7.1.26). */
    private static double Phi(double x) {
        return 0.5 * (1.0 + erf(x / Math.sqrt(2.0)));
    }

    /** Gauss'sche Fehlerfunktion — max. Fehler |ε| < 1.5×10⁻⁷. */
    private static double erf(double x) {
        double t = 1.0 / (1.0 + 0.3275911 * Math.abs(x));
        double y = 1.0 - (((((1.061405429 * t
            - 1.453152027) * t
            + 1.421413741) * t
            - 0.284496736) * t
            + 0.254829592) * t) * Math.exp(-x * x);
        return Math.copySign(y, x);
    }
}
