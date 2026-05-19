package de.locodoko.partie;

import java.util.ArrayList;
import java.util.List;

/** Schreibt transiente Domain-Felder eines Spiel zurück in die DB-Spalten. */
class SpielPersistenzSync {

    static void sync(Spiel spiel) {
        if (spiel.spielregeln == null) return;
        spiel.geberPosition = spiel.geber.name();
        spiel.spieltypText = spiel.spieltyp.name();
        spiel.phaseText = spiel.phase.name();
        spiel.vorbehalteJson = JsonKonverter.schreibeAlsJson(spiel.vorbehalte.stream()
            .map(m -> VorbehaltMeldungEmbeddable.neu(m.spielerPosition(), m.ansage())).toList());
        spiel.ansagenJson = JsonKonverter.schreibeAlsJson(spiel.ansagen.ereignisse().stream()
            .map(e -> AnsageEreignisEmbeddable.neu(e.spieler(), e.ansage())).toList());
        if (spiel.ergebnis != null) { syncErgebnis(spiel, spiel.ergebnis); } else { leereErgebnis(spiel); }
        spiel.haendeJson = JsonKonverter.schreibeAlsJson(SpielerPosition.standardReihenfolge().stream()
            .filter(spiel.haende::containsKey)
            .map(p -> HandJsonEintrag.aus(p, spiel.haende.get(p).karten())).toList());
        spiel.sticheJson = JsonKonverter.schreibeAlsJson(alsStichJsonEintraege(spiel));
        spiel.aktuellerStich().ifPresentOrElse(
            s -> { spiel.aktuellerStichAufspielerPositionText = s.aufspieler().name();
                   spiel.aktuellerStichKartenJson = JsonKonverter.schreibeAlsJson(
                       s.gespielteKarten().stream().map(AktuellerStichKarteEmbeddable::aus).toList()); },
            () -> { spiel.aktuellerStichAufspielerPositionText = null; spiel.aktuellerStichKartenJson = "[]"; });
        spiel.armutStatus().ifPresentOrElse(
            st -> { spiel.armutSpielerPosition = st.armutSpieler().name();
                    spiel.armutAktuellerAntwortIndex = st.aktuellerIndex();
                    spiel.armutAngebotAbgegeben = st.angebotLiegtVor();
                    spiel.armutPartnerSpielerPosition = st.partner().map(SpielerPosition::name).orElse(null);
                    spiel.armutAngeboteneKartenJson = JsonKonverter.schreibeAlsJson(
                        st.partner().isPresent() ? List.of() : st.angeboteneTrumpfkarten().stream().map(HandKarteEmbeddable::aus).toList()); },
            () -> { spiel.armutSpielerPosition = null; spiel.armutAktuellerAntwortIndex = 0;
                    spiel.armutAngebotAbgegeben = false; spiel.armutPartnerSpielerPosition = null;
                    spiel.armutAngeboteneKartenJson = "[]"; });
        spiel.hochzeitStatus().ifPresentOrElse(
            st -> { spiel.hochzeitSpielerPositionText = st.hochzeitSpieler().name();
                    spiel.hochzeitGeklaerteStiche = st.geklaerteStiche();
                    spiel.hochzeitPartnerSpielerPositionText = st.partner().map(SpielerPosition::name).orElse(null);
                    spiel.hochzeitStillesSolo = st.stillesSolo(); },
            () -> { spiel.hochzeitSpielerPositionText = null; spiel.hochzeitGeklaerteStiche = 0;
                    spiel.hochzeitPartnerSpielerPositionText = null; spiel.hochzeitStillesSolo = false; });
        spiel.pflichtAnsageAusstehendJson = JsonKonverter.schreibeAlsJson(
            spiel.pflichtansageAusstehend().stream().map(Enum::name).toList());
        spiel.schweinchenAktivFlag = spiel.schweinchenAktiv();
        spiel.bereitsGeschmisenJson = JsonKonverter.schreibeAlsJson(
            spiel.bereitsGeschmissen.stream().map(Enum::name).toList());
        spiel.einwurfZaehlerDb = spiel.einwurfZaehler;
    }

    private static void syncErgebnis(Spiel spiel, Spielergebnis se) {
        SpielErgebnisEmbeddable e = SpielErgebnisEmbeddable.aus(se);
        spiel.reAugen = e.reAugen(); spiel.kontraAugen = e.kontraAugen();
        spiel.siegerParteiText = e.siegerPartei() != null ? e.siegerPartei().name() : null;
        spiel.spielwertPunkte = e.spielwert(); spiel.grundwertDb = e.grundwert();
        spiel.absagePunkteDb = e.absagePunkte(); spiel.gegenDieAltenPunkteDb = e.gegenDieAltenPunkte();
        spiel.soloMultiplikatorDb = e.soloMultiplikator();
        spiel.spielpunkteSued = e.spielpunkteSued(); spiel.spielpunkteWest = e.spielpunkteWest();
        spiel.spielpunkteNord = e.spielpunkteNord(); spiel.spielpunkteOst = e.spielpunkteOst();
        List<SonderpunktJsonEintrag> sonderpunkte = new ArrayList<>();
        for (var eintrag : se.sonderpunkteProPartei().entrySet()) {
            for (SonderpunktEreignis er : eintrag.getValue()) {
                sonderpunkte.add(SonderpunktJsonEintrag.aus(eintrag.getKey(), er));
            }
        }
        spiel.sonderpunkteJson = JsonKonverter.schreibeAlsJson(sonderpunkte);
    }

    private static void leereErgebnis(Spiel spiel) {
        spiel.reAugen = null; spiel.kontraAugen = null; spiel.siegerParteiText = null;
        spiel.spielwertPunkte = null; spiel.grundwertDb = null; spiel.absagePunkteDb = null;
        spiel.gegenDieAltenPunkteDb = null; spiel.soloMultiplikatorDb = null;
        spiel.spielpunkteSued = null; spiel.spielpunkteWest = null;
        spiel.spielpunkteNord = null; spiel.spielpunkteOst = null;
        spiel.sonderpunkteJson = "[]";
    }

    private static List<StichJsonEintrag> alsStichJsonEintraege(Spiel spiel) {
        List<StichJsonEintrag> res = new ArrayList<>();
        int idx = 1;
        for (Stich s : spiel.abgeschlosseneStiche) {
            res.add(new StichJsonEintrag(idx++, s.aufspieler(), s.gewinner(spiel.trumpfOrdnung).spieler(),
                s.augen().wert(), s.gespielteKarten().stream().map(AktuellerStichKarteEmbeddable::aus).toList()));
        }
        return List.copyOf(res);
    }
}
