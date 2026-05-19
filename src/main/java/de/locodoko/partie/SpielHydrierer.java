package de.locodoko.partie;

import com.fasterxml.jackson.core.type.TypeReference;
import de.locodoko.karten.Augen;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Rekonstruiert transiente Domain-Felder aus den DB-Spalten eines Spiel. */
class SpielHydrierer {

    static void hydriere(Spiel spiel, Spielregeln spielregeln, SpielerPosition solistDesLetztenSpiels) {
        spiel.spielregeln = spielregeln;
        spiel.solistAufspieler = solistDesLetztenSpiels;
        EnumMap<SpielerPosition, Hand> gh = new EnumMap<>(SpielerPosition.class);
        for (HandJsonEintrag e : spiel.haendeAlsJson()) {
            gh.put(e.spielerPosition(), new Hand(e.karten().stream().map(SpielHydrierer::alsKarte).toList()));
        }
        spiel.haende = Map.copyOf(gh);
        spiel.vorbehalte = spiel.vorbehalteAlsEmbeddable().stream()
            .map(e -> new VorbehaltMeldung(e.spielerPosition(), e.ansage())).toList();
        spiel.ansagen = Ansagen.ausEreignissen(spiel.ansagenAlsEmbeddable().stream()
            .map(e -> new AnsageEreignis(e.spielerPosition(), e.ansage())).toList());
        spiel.abgeschlosseneStiche = spiel.sticheAlsJson().stream().map(SpielHydrierer::alsStich).toList();
        spiel.spieltyp = Spieltyp.valueOf(spiel.spieltypText);
        spiel.geber = SpielerPosition.valueOf(spiel.geberPosition);
        List<de.locodoko.karten.Karte> alleKarten = new ArrayList<>();
        spiel.haendeAlsJson().forEach(h -> h.karten().forEach(k -> alleKarten.add(alsKarte(k))));
        spiel.sticheAlsJson().forEach(s -> s.gespielteKarten().forEach(k -> alleKarten.add(alsKarte(k))));
        spiel.aktuellerStichKarten().forEach(k -> alleKarten.add(alsKarte(k)));
        if ("ARMUT_TAUSCH".equals(spiel.phaseText) && spiel.armutPartnerSpielerPosition == null) {
            spiel.armutAngeboteneKartenDb().forEach(k -> alleKarten.add(alsKarte(k)));
        }
        spiel.kartendeck = de.locodoko.karten.Kartendeck.ausKarten(alleKarten);
        spiel.trumpfOrdnung = SpielVorbehaltAufloesung.trumpfOrdnungFuerPersistiertenStand(spielregeln, spiel.spieltyp, spiel.schweinchenAktivFlag);
        spiel.phase = hydrierePhase(spiel);
        spiel.parteien = hydriereParteien(spiel).orElse(null);
        spiel.ergebnis = hydriereErgebnis(spiel).orElse(null);
        spiel.bereitsGeschmissen = hydriereBereitsGeschmissen(spiel);
        spiel.einwurfZaehler = spiel.einwurfZaehlerDb;
    }

    static Spielphase hydrierePhase(Spiel spiel) {
        return switch (spiel.phaseText) {
            case "KARTEN_AUSTEILEN" -> Spielphase.KARTEN_AUSTEILEN;
            case "VORBEHALT_ANSAGE" -> Spielphase.VORBEHALT_ANSAGE;
            case "VORBEHALT_AUFLOESUNG" -> Spielphase.VORBEHALT_AUFLOESUNG;
            case "ARMUT_TAUSCH" -> new Spielphase.ArmutTausch(hydriereArmutStatus(spiel)
                .orElseThrow(() -> new IllegalStateException("ARMUT_TAUSCH ohne ArmutStatus")));
            case "STICHPHASE" -> new Spielphase.Stichphase(hydriereAktuellenStich(spiel),
                hydrierePflichtansageAusstehend(spiel), hydriereHochzeitStatus(spiel).orElse(null));
            case "AUSWERTUNG" -> Spielphase.AUSWERTUNG;
            case "GESAMTSTAND_AKTUALISIEREN" -> Spielphase.GESAMTSTAND_AKTUALISIEREN;
            default -> throw new IllegalStateException("Unbekannte Phase: " + spiel.phaseText);
        };
    }

    static Optional<Parteien> hydriereParteien(Spiel spiel) {
        if (!istAufgeloest(spiel.phaseText)) { return Optional.empty(); }
        VorbehaltMeldung hoechster = hoechsterVorbehaltAusListe(spiel.vorbehalte).orElse(null);
        Parteien basis;
        if (hoechster == null) {
            basis = spiel.spieltyp == Spieltyp.SOLO_TRUMPF && erkenneStillesSoloSpielerAusPersistenz(spiel) != null
                ? Parteien.ausSolo(erkenneStillesSoloSpielerAusPersistenz(spiel))
                : parteienFuerNormalspiel(spiel);
        } else {
            Optional<Parteien> sp = switch (hoechster.ansage()) {
                case SOLO_DAME, SOLO_BUBE, SOLO_TRUMPF, SOLO_TRUMPF_HERZ, SOLO_TRUMPF_PIK, SOLO_TRUMPF_KREUZ, SOLO_FLEISCHLOS ->
                    Optional.of(Parteien.ausSolo(hoechster.spielerPosition()));
                case HOCHZEIT -> Optional.of(hydriereParteienFuerHochzeit(spiel, hoechster.spielerPosition()));
                case ARMUT -> Optional.of(hydriereParteienFuerArmut(spiel, hoechster.spielerPosition()));
                case GESUND, SCHMEISSEN, SCHMEISSEN_FUENF_NEUNEN, SCHMEISSEN_WENIG_TRUMPF -> Optional.empty();
            };
            if (sp.isEmpty()) { return Optional.empty(); }
            basis = sp.get();
        }
        List<SpielerPosition> offenbart = spiel.ansagen.ereignisse().stream()
            .filter(e -> e.ansage().istGrundansage()).map(AnsageEreignis::spieler).toList();
        if (!offenbart.isEmpty()) { basis = basis.mitOffenenParteienFuerAlle(offenbart); }
        return Optional.of(basis);
    }

    private static Parteien hydriereParteienFuerHochzeit(Spiel spiel, SpielerPosition hs) {
        if (spiel.hochzeitPartnerSpielerPositionDb() != null) {
            return Parteien.ausHochzeit(hs).mitPartei(spiel.hochzeitPartnerSpielerPositionDb(), Partei.RE)
                .mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge());
        }
        return spiel.hochzeitStillesSolo ? Parteien.ausSolo(hs) : Parteien.ausHochzeit(hs);
    }

    private static Parteien hydriereParteienFuerArmut(Spiel spiel, SpielerPosition as) {
        Parteien p = Parteien.ausArmut(as);
        return spiel.armutPartnerSpielerPositionDb() == null ? p
            : p.mitPartei(spiel.armutPartnerSpielerPositionDb(), Partei.RE)
                .mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge());
    }

    private static Parteien parteienFuerNormalspiel(Spiel spiel) {
        EnumSet<SpielerPosition> re = EnumSet.noneOf(SpielerPosition.class);
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
            if (hatKreuzDameAusPersistenz(spiel, pos)) { re.add(pos); }
        }
        if (re.size() != 2) { throw new IllegalStateException("Ein Normalspiel braucht genau zwei Re-Spieler, gefunden: " + re.size()); }
        EnumMap<SpielerPosition, Partei> pm = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) { pm.put(pos, re.contains(pos) ? Partei.RE : Partei.KONTRA); }
        return Parteien.ausParteiMap(pm);
    }

    private static boolean hatKreuzDameAusPersistenz(Spiel spiel, SpielerPosition pos) {
        Hand h = spiel.haende.get(pos);
        if (h != null && h.karten().stream().anyMatch(SpielHydrierer::istKreuzDame)) { return true; }
        if (spiel.sticheAlsJson().stream().flatMap(s -> s.gespielteKarten().stream())
            .filter(k -> k.spielerPosition() == pos).map(SpielHydrierer::alsKarte).anyMatch(SpielHydrierer::istKreuzDame)) { return true; }
        return spiel.aktuellerStichKarten().stream()
            .filter(k -> k.spielerPosition() == pos).map(SpielHydrierer::alsKarte).anyMatch(SpielHydrierer::istKreuzDame);
    }

    private static SpielerPosition erkenneStillesSoloSpielerAusPersistenz(Spiel spiel) {
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
            Hand h = spiel.haende.get(pos);
            long a = h == null ? 0 : h.karten().stream().filter(SpielHydrierer::istKreuzDame).count();
            long b = spiel.sticheAlsJson().stream().flatMap(s -> s.gespielteKarten().stream())
                .filter(k -> k.spielerPosition() == pos).map(SpielHydrierer::alsKarte).filter(SpielHydrierer::istKreuzDame).count();
            long c = spiel.aktuellerStichKarten().stream()
                .filter(k -> k.spielerPosition() == pos).map(SpielHydrierer::alsKarte).filter(SpielHydrierer::istKreuzDame).count();
            if (a + b + c >= 2) { return pos; }
        }
        return null;
    }

    static Optional<HochzeitStatus> hydriereHochzeitStatus(Spiel spiel) {
        if (spiel.hochzeitSpielerPositionDb() != null) {
            return Optional.of(new HochzeitStatus(spiel.hochzeitSpielerPositionDb(), spiel.hochzeitGeklaerteSticheDb(),
                spiel.hochzeitPartnerSpielerPositionDb(), spiel.hochzeitStillesSoloDb()));
        }
        if (!istAufgeloest(spiel.phaseText)) { return Optional.empty(); }
        return hoechsterVorbehaltAusListe(spiel.vorbehalte)
            .filter(m -> m.ansage() == VorbehaltAnsage.HOCHZEIT)
            .map(m -> HochzeitStatus.gestartet(m.spielerPosition()));
    }

    static Optional<ArmutStatus> hydriereArmutStatus(Spiel spiel) {
        if (spiel.armutSpielerPosition == null && !istAufgeloest(spiel.phaseText)) { return Optional.empty(); }
        SpielerPosition as = spiel.armutSpielerPositionDb();
        if (as == null) {
            as = hoechsterVorbehaltAusListe(spiel.vorbehalte)
                .filter(m -> m.ansage() == VorbehaltAnsage.ARMUT)
                .map(VorbehaltMeldung::spielerPosition).orElse(null);
        }
        if (as == null) { return Optional.empty(); }
        SpielerPosition fas = as;
        List<SpielerPosition> reihenfolge = SpielerPosition.imUhrzeigersinnAb(fas.naechsteImUhrzeigersinn())
            .stream().filter(p -> p != fas).toList();
        return Optional.of(new ArmutStatus(fas, reihenfolge, spiel.armutAktuellerAntwortIndexDb(),
            spiel.armutAngeboteneKartenDb().stream().map(SpielHydrierer::alsKarte).toList(),
            spiel.armutAngebotAbgegebenDb(), spiel.armutPartnerSpielerPositionDb()));
    }

    static Stich hydriereAktuellenStich(Spiel spiel) {
        if (spiel.aktuellerStichAufspielerPosition() != null) {
            return Stich.ausPersistiertemStand(spiel.aktuellerStichAufspielerPosition(),
                spiel.aktuellerStichKarten().stream().map(SpielHydrierer::alsGespielteKarte).toList());
        }
        return Stich.neu(spiel.sticheAlsJson().isEmpty()
            ? SpielerPosition.valueOf(spiel.geberPosition).naechsteImUhrzeigersinn()
            : spiel.sticheAlsJson().getLast().gewinnerPosition());
    }

    static Set<Partei> hydrierePflichtansageAusstehend(Spiel spiel) {
        List<String> n = spiel.pflichtansageAusstehendDb();
        if (n.isEmpty()) { return Set.of(); }
        EnumSet<Partei> r = EnumSet.noneOf(Partei.class);
        n.forEach(name -> r.add(Partei.valueOf(name)));
        return Set.copyOf(r);
    }

    static Set<SpielerPosition> hydriereBereitsGeschmissen(Spiel spiel) {
        List<String> n = JsonKonverter.liesList(
            spiel.bereitsGeschmisenJson != null ? spiel.bereitsGeschmisenJson : "[]",
            new TypeReference<>() {});
        if (n.isEmpty()) { return Set.of(); }
        EnumSet<SpielerPosition> r = EnumSet.noneOf(SpielerPosition.class);
        n.forEach(name -> r.add(SpielerPosition.valueOf(name)));
        return Set.copyOf(r);
    }

    static Optional<Spielergebnis> hydriereErgebnis(Spiel spiel) {
        SpielErgebnisEmbeddable e = spiel.ergebnisEmbeddable();
        if (e == null) { return Optional.empty(); }
        EnumMap<Partei, Augen> ap = new EnumMap<>(Partei.class);
        ap.put(Partei.RE, new Augen(e.reAugen())); ap.put(Partei.KONTRA, new Augen(e.kontraAugen()));
        EnumMap<SpielerPosition, Spielpunkte> sp = new EnumMap<>(SpielerPosition.class);
        sp.put(SpielerPosition.SUED, new Spielpunkte(e.spielpunkteSued()));
        sp.put(SpielerPosition.WEST, new Spielpunkte(e.spielpunkteWest()));
        sp.put(SpielerPosition.NORD, new Spielpunkte(e.spielpunkteNord()));
        sp.put(SpielerPosition.OST, new Spielpunkte(e.spielpunkteOst()));
        EnumMap<Partei, List<SonderpunktEreignis>> spp = new EnumMap<>(Partei.class);
        List<SonderpunktJsonEintrag> eintraege = spiel.sonderpunkteAlsJson();
        spp.put(Partei.RE, eintraege.stream().filter(x -> x.partei() == Partei.RE).map(SonderpunktJsonEintrag::ereignis).toList());
        spp.put(Partei.KONTRA, eintraege.stream().filter(x -> x.partei() == Partei.KONTRA).map(SonderpunktJsonEintrag::ereignis).toList());
        Integer gw = e.grundwert(); Integer abp = e.absagePunkte(); Integer gdap = e.gegenDieAltenPunkte(); Integer sm = e.soloMultiplikator();
        return Optional.of(new Spielergebnis(ap, e.siegerPartei(), new Spielpunkte(e.spielwert()),
            gw != null ? gw : e.spielwert(), abp != null ? abp : 0, gdap != null ? gdap : 0,
            sm != null ? sm : 1, sp, spp));
    }

    static Optional<VorbehaltMeldung> hoechsterVorbehaltAusListe(List<VorbehaltMeldung> vorbehalte) {
        VorbehaltMeldung best = null;
        for (VorbehaltMeldung m : vorbehalte) {
            if (!m.istVorbehalt()) continue;
            if (best == null || m.ansage().prioritaet() > best.ansage().prioritaet()) best = m;
        }
        return Optional.ofNullable(best);
    }

    static boolean istAufgeloest(String pn) {
        return switch (pn) {
            case "ARMUT_TAUSCH", "STICHPHASE", "AUSWERTUNG", "GESAMTSTAND_AKTUALISIEREN" -> true;
            default -> false;
        };
    }

    static de.locodoko.karten.Karte alsKarte(HandKarteEmbeddable k) { return new de.locodoko.karten.Karte(k.farbe(), k.wert(), k.exemplarIndex()); }
    static de.locodoko.karten.Karte alsKarte(AktuellerStichKarteEmbeddable k) { return new de.locodoko.karten.Karte(k.farbe(), k.wert(), k.exemplarIndex()); }
    static GespielteKarte alsGespielteKarte(AktuellerStichKarteEmbeddable k) { return new GespielteKarte(k.spielerPosition(), alsKarte(k), k.reihenfolge()); }
    static Stich alsStich(StichJsonEintrag e) { return Stich.ausPersistiertemStand(e.aufspielerPosition(), e.gespielteKarten().stream().map(SpielHydrierer::alsGespielteKarte).toList()); }
    static boolean istKreuzDame(de.locodoko.karten.Karte k) { return k.farbe() == Farbe.KREUZ && k.wert() == Kartenwert.DAME; }
}
