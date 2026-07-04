package de.locodoko.spieler;

/** Minimales Interface fuer TrueSkill-faehige Entitaeten (Statistik pro Regelvariante oder globales Rating). */
interface TrueSkillTeilnehmer {
    double ratingMu();
    double ratingSigma();
    void aktualisiereRating(double neueMu, double neueSigma);
}
