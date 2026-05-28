package de.locodoko.partie;

import de.locodoko.karten.UngueltigerSpielzugException;
import de.locodoko.karten.BubensoloTrumpfOrdnung;
import de.locodoko.karten.DamensoloTrumpfOrdnung;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.FleischlosTrumpfOrdnung;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.SchweinchenTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.karten.TrumpfOrdnung;
import de.locodoko.karten.VariableTrumpfsoloTrumpfOrdnung;
import de.locodoko.system.AbstraktePersistenzEntity;
import org.springframework.data.annotation.ReadOnlyProperty;
import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Ein einzelnes Doppelkopf-Spiel innerhalb einer Partie.
 *
 * <p>Zentraler Domain-Kern und Persistenz-Entity des laufenden Spiels. Der fachliche Zustand
 * wird direkt als Persistenzmodell gespeichert; JSONB-Spalten halten innere Aggregate wie Hände,
 * Stiche, Vorbehalte, Ansagen, Parteien und Phasen-spezifische Statusobjekte.</p>
 */
@Table("laufendes_spiel")
public class Spiel extends AbstraktePersistenzEntity {

    @Column("spielregeln") Spielregeln spielregeln;
    @Transient transient Kartendeck kartendeck;
    @Transient transient TrumpfOrdnung trumpfOrdnung;
    @Column("spieltyp") Spieltyp spieltyp;
    @Column("geber_position") SpielerPosition geber;
    @Column("phase") String phaseText;
    @Column("haende") Haende haende = Haende.leer();
    @Column("vorbehalt_meldungen") VorbehaltMeldungen vorbehalte = VorbehaltMeldungen.leer();
    @Column("partei_zuordnungen") Parteien parteien;
    @Column("ansage_ereignisse") Ansagen ansagen = Ansagen.leer();
    @Column("abgeschlossene_stiche") Stichverlauf abgeschlosseneStiche = Stichverlauf.leer();
    @Column("ergebnis") Spielergebnis ergebnis;
    /** Position des Solisten aus dem vorherigen Spiel; bestimmt den ersten Aufspieler. */
    @Column("solist_aufspieler") SpielerPosition solistAufspieler;
    @Column("bereits_geschmissen") GeschmisseneSpieler bereitsGeschmissen = GeschmisseneSpieler.leer();
    /** Anzahl der Einwürfe (Schmeißen oder abgelehnte Armut) in diesem Spiel — für Einwurf-Bockrunden-Trigger. */
    @Column("einwurf_zaehler") int einwurfZaehler = 0;
    @ReadOnlyProperty
    @Column("spiel_nummer")
    private int spielNummer;

    @Column("trumpf_ordnung_typ") String trumpfOrdnungTyp = "NORMAL";
    @Column("schweinchen_aktiv") boolean schweinchenAktivFlag;
    @Column("aktueller_stich") Stich aktuellerStich;
    @Column("pflicht_ansage_ausstehend") PflichtAnsagen pflichtAnsageAusstehend = PflichtAnsagen.leer();
    @Column("armut_status") ArmutStatus armutStatus;
    @Column("hochzeit_status") HochzeitStatus hochzeitStatus;

    /** No-arg-Konstruktor fuer Spring Data JDBC. */
    protected Spiel() {
        super();
    }

    Spiel(
        Spielregeln spielregeln, Kartendeck kartendeck, TrumpfOrdnung trumpfOrdnung,
        Spieltyp spieltyp, SpielerPosition geber, Spielphase phase,
        Map<SpielerPosition, Hand> haende, List<VorbehaltMeldung> vorbehalte,
        Parteien parteien, Ansagen ansagen, List<Stich> abgeschlosseneStiche,
        Spielergebnis ergebnis, SpielerPosition solistAufspieler
    ) {
        super();
        this.spielregeln = Objects.requireNonNull(spielregeln, "spielregeln duerfen nicht null sein");
        this.kartendeck = Objects.requireNonNull(kartendeck, "kartendeck darf nicht null sein");
        this.spieltyp = Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein");
        this.geber = Objects.requireNonNull(geber, "geber darf nicht null sein");
        this.haende = Haende.aus(haende);
        this.vorbehalte = VorbehaltMeldungen.aus(vorbehalte);
        this.parteien = parteien;
        this.ansagen = Objects.requireNonNull(ansagen, "ansagen duerfen nicht null sein");
        this.abgeschlosseneStiche = Stichverlauf.aus(abgeschlosseneStiche);
        this.ergebnis = ergebnis;
        this.solistAufspieler = solistAufspieler;
        setzeTrumpfOrdnung(Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein"));
        setzePhase(Objects.requireNonNull(phase, "phase darf nicht null sein"));
    }

    public static Spiel neu(SpielerPosition geber, Spielregeln spielregeln, Kartendeck kartendeck) {
        Objects.requireNonNull(geber, "geber darf nicht null sein");
        return new Spiel(
            spielregeln,
            kartendeck,
            new NormaleTrumpfOrdnung(spielregeln),
            Spieltyp.NORMALSPIEL,
            geber,
            Spielphase.KARTEN_AUSTEILEN,
            Map.of(),
            List.of(),
            null,
            Ansagen.leer(),
            List.of(),
            null,
            null
        );
    }

    /** Wie {@link #neu}, aber der Solist des vorherigen Spiels erhaelt das Anspielrecht. */
    public static Spiel neuMitSolistAufspieler(SpielerPosition geber, SpielerPosition solistAufspieler, Spielregeln spielregeln, Kartendeck kartendeck) {
        Objects.requireNonNull(geber, "geber darf nicht null sein");
        Objects.requireNonNull(solistAufspieler, "solistAufspieler darf nicht null sein");
        return new Spiel(
            spielregeln,
            kartendeck,
            new NormaleTrumpfOrdnung(spielregeln),
            Spieltyp.NORMALSPIEL,
            geber,
            Spielphase.KARTEN_AUSTEILEN,
            Map.of(),
            List.of(),
            null,
            Ansagen.leer(),
            List.of(),
            null,
            solistAufspieler
        );
    }

    /**
     * Rekonstituiert einen Spielzustand für Tests.
     *
     * <p>War ursprünglich für {@code SpielHydrierer} gedacht (gelöscht in DB-4c). Heute ausschließlich
     * in Tests verwendet, um komplexe Spielszenarien mit vollständigem Zustand aufzubauen.
     * Spring Data JDBC lädt {@code Spiel} direkt via {@code SpielNachLadenCallback}.</p>
     */
    public static Spiel ausPersistiertemStand(
        Spielregeln spielregeln, Kartendeck kartendeck, Spieltyp spieltyp,
        SpielerPosition geber, Spielphase phase, Map<SpielerPosition, Hand> haende,
        List<VorbehaltMeldung> vorbehalte, Parteien parteien, Ansagen ansagen,
        List<Stich> abgeschlosseneStiche, Spielergebnis ergebnis,
        boolean schweinchenAktiv, SpielerPosition solistAufspieler
    ) {
        return ausPersistiertemStand(spielregeln, kartendeck, spieltyp, geber, phase, haende,
            vorbehalte, parteien, ansagen, abgeschlosseneStiche, ergebnis, schweinchenAktiv, solistAufspieler, 0);
    }

    /** Wie {@link #ausPersistiertemStand(Spielregeln, Kartendeck, Spieltyp, SpielerPosition, Spielphase, Map, List, Parteien, Ansagen, List, Spielergebnis, boolean, SpielerPosition)}, zusätzlich mit {@code einwurfZaehler}. */
    public static Spiel ausPersistiertemStand(
        Spielregeln spielregeln, Kartendeck kartendeck, Spieltyp spieltyp,
        SpielerPosition geber, Spielphase phase, Map<SpielerPosition, Hand> haende,
        List<VorbehaltMeldung> vorbehalte, Parteien parteien, Ansagen ansagen,
        List<Stich> abgeschlosseneStiche, Spielergebnis ergebnis,
        boolean schweinchenAktiv, SpielerPosition solistAufspieler, int einwurfZaehler
    ) {
        Spiel spiel = new Spiel(
            spielregeln,
            kartendeck,
            SpielVorbehaltAufloesung.trumpfOrdnungFuerPersistiertenStand(spielregeln, spieltyp, schweinchenAktiv),
            spieltyp,
            geber,
            phase,
            haende,
            vorbehalte,
            parteien,
            ansagen,
            abgeschlosseneStiche,
            ergebnis,
            solistAufspieler
        );
        spiel.schweinchenAktivFlag = schweinchenAktiv;
        spiel.einwurfZaehler = einwurfZaehler;
        return spiel;
    }

    /**
     * Erstellt eine minimale Persistenz-Entity für Persistenz-Tests.
     *
     * <p>Nur für Tests: erzeugt ein {@code Spiel} mit Defaults für alle nicht gesetzten Felder.
     * Wird ausschließlich in {@code PersistenzRepositoryTest} und ähnlichen Tests verwendet.</p>
     */
    public static Spiel neuePersistenz(int spielNummer, SpielerPosition geberPosition, Spieltyp spieltyp, Spielphase phase) {
        Spiel spiel = new Spiel();
        spiel.spielNummer = spielNummer;
        spiel.spielregeln = Spielregeln.standardRegeln();
        spiel.geber = geberPosition;
        spiel.spieltyp = spieltyp;
        spiel.setzeTrumpfOrdnung(SpielVorbehaltAufloesung.trumpfOrdnungFuerPersistiertenStand(spiel.spielregeln, spieltyp, false));
        spiel.setzePhase(phase);
        return spiel;
    }

    public static Map<SpielerPosition, Integer> gewonneneStiche(Spiel spiel) {
        EnumMap<SpielerPosition, Integer> map = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
            map.put(pos, 0);
        }
        spiel.abgeschlosseneStiche().forEach(s -> map.merge(s.gewinner(spiel.trumpfOrdnung()).spieler(), 1, Integer::sum));
        return Map.copyOf(map);
    }

    public List<SpielEreignis> teileKartenAus() {
        pruefePhase(Spielphase.KartenAusteilen.class, "Karten austeilen");
        Map<SpielerPosition, Hand> neueHaende = SpielVorbehaltAufloesung.haendeAusDeck(effektivesKartendeck());
        setzeTrumpfOrdnung(SpielVorbehaltAufloesung.hatSchweinchen(spielregeln, neueHaende)
            ? new SchweinchenTrumpfOrdnung(spielregeln)
            : trumpfOrdnung());
        setzePhase(Spielphase.VORBEHALT_ANSAGE);
        this.haende = Haende.aus(neueHaende);
        this.vorbehalte = VorbehaltMeldungen.leer();
        this.parteien = null;
        this.ergebnis = null;
        return List.of();
    }

    public Optional<SpielerPosition> naechsterVorbehaltSpieler() {
        Spielphase aktuellePhase = phase();
        if (!(aktuellePhase instanceof Spielphase.VorbehaltAnsage) || vorbehalte.anzahl() >= SpielerPosition.standardReihenfolge().size()) {
            return Optional.empty();
        }
        return Optional.of(SpielerPosition.imUhrzeigersinnAb(geber.naechsteImUhrzeigersinn()).get(vorbehalte.anzahl()));
    }

    public List<SpielEreignis> meldeGesund(SpielerPosition spielerPosition) { return meldeVorbehalt(spielerPosition, VorbehaltAnsage.GESUND); }

    public List<SpielEreignis> meldeVorbehalt(SpielerPosition spielerPosition, VorbehaltAnsage vorbehaltAnsage) {
        pruefePhase(Spielphase.VorbehaltAnsage.class, "Gesund melden");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(vorbehaltAnsage, "vorbehaltAnsage darf nicht null sein");
        SpielerPosition erwarteterSpieler = naechsterVorbehaltSpieler().orElseThrow(() -> new SpielzugKonfliktException("Es werden keine Vorbehalte mehr erwartet"));
        if (spielerPosition != erwarteterSpieler) {
            throw new SpielzugKonfliktException("Vorbehalte muessen in Sitzreihenfolge gemeldet werden; erwartet: " + erwarteterSpieler);
        }
        if (vorbehaltAnsage.istSchmeissen() && bereitsGeschmissen.enthaelt(spielerPosition)) {
            throw new SpielzugKonfliktException("Spieler " + spielerPosition + " hat das Schmeiss-Recht in diesem Spiel bereits genutzt");
        }
        if (!vorbehaltAnsage.istZulaessig(handVon(spielerPosition), spielregeln)) {
            throw new UngueltigerSpielzugException("Vorbehalt " + vorbehaltAnsage + " ist fuer " + spielerPosition + " nach den Spielregeln nicht zulaessig");
        }
        VorbehaltMeldungen neueVorbehalte = vorbehalte.mitMeldung(new VorbehaltMeldung(spielerPosition, vorbehaltAnsage));
        Spielphase naechstePhase = neueVorbehalte.anzahl() == SpielerPosition.standardReihenfolge().size() ? Spielphase.VORBEHALT_AUFLOESUNG : Spielphase.VORBEHALT_ANSAGE;
        this.bereitsGeschmissen = vorbehaltAnsage.istSchmeissen() ? bereitsGeschmissen.mitPosition(spielerPosition) : bereitsGeschmissen;
        setzePhase(naechstePhase);
        this.vorbehalte = neueVorbehalte;
        return List.of();
    }

    public List<SpielEreignis> loeseVorbehalteAuf() {
        pruefePhase(Spielphase.VorbehaltAufloesung.class, "Vorbehalte aufloesen");
        SpielVorbehaltAufloesung.aufloesen(this, vorbehalte.meldungen(), trumpfOrdnung(),
            spielregeln, haende.alsMap(), geber, solistAufspieler, effektivesKartendeck(), einwurfZaehler);
        return List.of();
    }

    public List<SpielEreignis> legeArmutTrumpfkarten(SpielerPosition spielerPosition, List<Karte> angeboteneTrumpfkarten) {
        Spielphase aktuellePhase = phase();
        if (!(aktuellePhase instanceof Spielphase.ArmutTausch armutTauschPhase)) {
            throw new SpielzugKonfliktException("Armut-Karten anbieten ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + aktuellePhase.name());
        }
        SpielArmutTausch.legeArmutTrumpfkarten(this, spielerPosition,
            angeboteneTrumpfkarten, armutTauschPhase.armutStatus(), handVon(spielerPosition), trumpfOrdnung(), haende.alsMap());
        return List.of();
    }

    public List<SpielEreignis> lehneArmutAb(SpielerPosition spielerPosition) {
        Spielphase aktuellePhase = phase();
        if (!(aktuellePhase instanceof Spielphase.ArmutTausch armutTauschPhase)) {
            throw new SpielzugKonfliktException("Armut ablehnen ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + aktuellePhase.name());
        }
        SpielArmutTausch.lehneArmutAb(this, spielerPosition,
            armutTauschPhase.armutStatus(), spielregeln, geber, einwurfZaehler, effektivesKartendeck());
        return List.of();
    }

    public List<SpielEreignis> nimmArmutAn(SpielerPosition spielerPosition, List<Karte> rueckgabekarten) {
        Spielphase aktuellePhase = phase();
        if (!(aktuellePhase instanceof Spielphase.ArmutTausch armutTauschPhase)) {
            throw new SpielzugKonfliktException("Armut annehmen ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + aktuellePhase.name());
        }
        SpielArmutTausch.nimmArmutAn(this, spielerPosition, rueckgabekarten,
            armutTauschPhase.armutStatus(), solistAufspieler, geber, haende.alsMap(), spielregeln, trumpfOrdnung(), parteien);
        return List.of();
    }

    public Optional<SpielerPosition> aktuellerSpieler() {
        Spielphase aktuellePhase = phase();
        return aktuellePhase instanceof Spielphase.Stichphase s ? Optional.of(s.aktuellerStich().erwarteterSpieler()) : Optional.empty();
    }

    public Optional<SpielerPosition> erwarteterSpieler() {
        return switch (phase()) {
            case Spielphase.VorbehaltAnsage _ -> naechsterVorbehaltSpieler();
            case Spielphase.ArmutTausch at -> {
                ArmutStatus st = at.armutStatus();
                yield st.angebotLiegtVor() ? st.aktuellerAntwortspieler() : Optional.of(st.armutSpieler());
            }
            case Spielphase.Stichphase _ -> aktuellerSpieler();
            default -> Optional.empty();
        };
    }

    public List<Karte> gueltigeKartenFuer(SpielerPosition spielerPosition) {
        Spielphase aktuellePhase = phase();
        if (!(aktuellePhase instanceof Spielphase.Stichphase stichphase)) {
            throw new SpielzugKonfliktException("gueltige Karten abfragen ist nur in Phase STICHPHASE erlaubt, war aber " + aktuellePhase.name());
        }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        SpielerPosition erw = aktuellerSpieler().orElseThrow(() -> new SpielzugKonfliktException("Es gibt aktuell keinen erwarteten Spieler"));
        if (spielerPosition != erw) {
            throw new SpielzugKonfliktException("Gueltige Karten koennen nur fuer den aktuellen Spieler abgefragt werden; erwartet: " + erw);
        }
        return stichphase.aktuellerStich().gueltigeKarten(handVon(spielerPosition), trumpfOrdnung());
    }

    public List<SpielEreignis> spieleKarte(SpielerPosition spielerPosition, Karte karte) {
        Spielphase aktuellePhase = phase();
        if (!(aktuellePhase instanceof Spielphase.Stichphase stichphase)) {
            throw new SpielzugKonfliktException("Karte spielen ist nur in Phase STICHPHASE erlaubt, war aber " + aktuellePhase.name());
        }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(karte, "karte darf nicht null sein");
        if (!stichphase.pflichtansageAusstehend().isEmpty()) {
            throw new UngueltigerSpielzugException("Karte spielen ist erst erlaubt wenn alle ausstehenden Pflichtansagen gemacht wurden: " + stichphase.pflichtansageAusstehend());
        }

        boolean schweinchenVorherGemeldet = schweinchenGemeldetVon().isPresent();
        Hand hand = handVon(spielerPosition);
        Stich gespielterStich = stichphase.aktuellerStich().spieleKarte(spielerPosition, karte, hand, trumpfOrdnung());

        List<SpielEreignis> ereignisse = new ArrayList<>();
        ereignisse.add(new SpielEreignis.KarteGespielt(spielerPosition, karte));

        if (!schweinchenVorherGemeldet && istKaroAs(karte) && schweinchenAktiv()) {
            ereignisse.add(new SpielEreignis.SchweinchenGemeldet(spielerPosition));
        }

        if (!gespielterStich.istVollstaendig()) {
            this.haende = haende.mitErsetzterHand(spielerPosition, hand.ohne(karte));
            setzePhase(new Spielphase.Stichphase(gespielterStich, stichphase.pflichtansageAusstehend(), stichphase.hochzeitStatus()));
            return List.copyOf(ereignisse);
        }
        Stichverlauf neueAbgeschlosseneStiche = abgeschlosseneStiche.mitStich(gespielterStich);
        HochzeitStatus alterHochzeitStatus = stichphase.hochzeitStatus();
        HochzeitFortschritt hf = fortschrittNachVollstaendigemStich(gespielterStich, alterHochzeitStatus);

        if (alterHochzeitStatus != null && alterHochzeitStatus.suchtPartner() && hf.status() != null && !hf.status().suchtPartner() && hf.status().partner().isPresent()) {
            ereignisse.add(new SpielEreignis.HochzeitPartnerGefunden(hf.status().partner().get()));
        }

        Set<Partei> neuesPflichtansageAusstehend = berechneNeuePflichtansagen(gespielterStich, neueAbgeschlosseneStiche.anzahl(), hf.parteien());
        List<SonderpunktEreignis> sonderpunkte = new SonderpunktBewerter()
            .bewerte(List.of(gespielterStich), hf.parteien(), trumpfOrdnung(), spielregeln, neueAbgeschlosseneStiche.anzahl() - 1)
            .values().stream().flatMap(List::stream).toList();
        ereignisse.add(new SpielEreignis.StichAbgeschlossenEreignis(gespielterStich, sonderpunkte));

        this.haende = haende.mitErsetzterHand(spielerPosition, hand.ohne(karte));
        this.abgeschlosseneStiche = neueAbgeschlosseneStiche;
        this.parteien = hf.parteien();
        this.solistAufspieler = null;

        if (neueAbgeschlosseneStiche.anzahl() == kartenProSpieler()) {
            setzePhase(Spielphase.AUSWERTUNG);
            return List.copyOf(ereignisse);
        }
        Stich naechsterStich = Stich.neu(gespielterStich.naechsterAufspieler(trumpfOrdnung()));
        setzePhase(new Spielphase.Stichphase(naechsterStich, neuesPflichtansageAusstehend, hf.status()));
        return List.copyOf(ereignisse);
    }

    private Set<Partei> berechneNeuePflichtansagen(Stich abgeschlossenerStich, int stichNummer, Parteien aktuelleParteien) {
        if (!spielregeln.dreissigAugenPflichtAktiv() || stichNummer > 2) {
            return Set.of();
        }
        if (spieltyp != Spieltyp.NORMALSPIEL && spieltyp != Spieltyp.HOCHZEIT) {
            return Set.of();
        }
        if (!abgeschlossenerStich.augen().ueberschreitet(30)) {
            return Set.of();
        }
        Partei gp = aktuelleParteien.parteiVon(abgeschlossenerStich.gewinner(trumpfOrdnung()).spieler());
        if (ansagen.hatGrundansage(gp, aktuelleParteien)) {
            return Set.of();
        }
        return Set.copyOf(EnumSet.of(gp));
    }

    public boolean kannAnsagen(SpielerPosition spielerPosition, Ansage ansage) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        Spielphase aktuellePhase = phase();
        if (!(aktuellePhase instanceof Spielphase.Stichphase stichphase)) {
            return false;
        }
        if (spielerPosition != stichphase.aktuellerStich().erwarteterSpieler()) {
            return false;
        }
        if (stichphase.hochzeitStatus() != null && stichphase.hochzeitStatus().suchtPartner() && spielerPosition != stichphase.hochzeitStatus().hochzeitSpieler()) {
            return false;
        }
        return ansagen.kannAnsagen(spielerPosition, ansage, parteien(), spielregeln, effektiveKartenAnzahlFuer(spielerPosition, ansage, stichphase.pflichtansageAusstehend()));
    }

    public List<SpielEreignis> sageAn(SpielerPosition spielerPosition, Ansage ansage) {
        Spielphase aktuellePhase = phase();
        if (!(aktuellePhase instanceof Spielphase.Stichphase stichphase)) {
            throw new SpielzugKonfliktException("Ansage taetigen ist nur in Phase STICHPHASE erlaubt, war aber " + aktuellePhase.name());
        }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        SpielerPosition erw = aktuellerSpieler().orElseThrow(() -> new SpielzugKonfliktException("Es gibt aktuell keinen erwarteten Spieler"));
        if (spielerPosition != erw) {
            throw new SpielzugKonfliktException("Ansagen duerfen nur vom aktuellen Spieler kommen; erwartet: " + erw);
        }
        if (stichphase.hochzeitStatus() != null && stichphase.hochzeitStatus().suchtPartner() && spielerPosition != stichphase.hochzeitStatus().hochzeitSpieler()) {
            throw new UngueltigerSpielzugException("Vor der Klaerung der Hochzeit darf nur der Hochzeits-Spieler Ansagen taetigen");
        }
        try {
            Ansagen neueAnsagen = ansagen.fuegeHinzu(spielerPosition, ansage, parteien(), spielregeln, effektiveKartenAnzahlFuer(spielerPosition, ansage, stichphase.pflichtansageAusstehend()));
        Parteien aktualisierteParteien = ansage.istGrundansage() ? parteien.mitOffenenParteienFuerAlle(List.of(spielerPosition)) : parteien;
        Set<Partei> aktualisiertesPflichtansageAusstehend = stichphase.pflichtansageAusstehend();
        if (ansage.istGrundansage() && !stichphase.pflichtansageAusstehend().isEmpty()) {
            Partei partei = parteien.parteiVon(spielerPosition);
            if (stichphase.pflichtansageAusstehend().contains(partei)) {
                EnumSet<Partei> m = EnumSet.copyOf(stichphase.pflichtansageAusstehend());
                m.remove(partei);
                aktualisiertesPflichtansageAusstehend = m.isEmpty() ? Set.of() : Set.copyOf(m);
            }
        }
            this.parteien = aktualisierteParteien;
            this.ansagen = neueAnsagen;
            setzePhase(new Spielphase.Stichphase(stichphase.aktuellerStich(), aktualisiertesPflichtansageAusstehend, stichphase.hochzeitStatus()));
            this.solistAufspieler = null;
            return List.of();
        } catch (IllegalStateException ex) {
            throw new UngueltigerSpielzugException(ex.getMessage());
        }
    }

    private int effektiveKartenAnzahlFuer(SpielerPosition pos, Ansage ansage, Set<Partei> pflichtansageAusstehend) {
        Partei partei = parteien().parteiVon(pos);
        return (!pflichtansageAusstehend.isEmpty() && pflichtansageAusstehend.contains(partei) && ansage.istGrundansage()) ? Integer.MAX_VALUE : handVon(pos).karten().size();
    }

    public List<SpielEreignis> werteAus() {
        pruefePhase(Spielphase.Auswertung.class, "Spiel auswerten");
        Spielergebnis neuesErgebnis = new PunkteRechner().berechneNormalspielErgebnis(abgeschlosseneStiche.stiche(), parteien(), trumpfOrdnung(), ansagen, spielregeln);
        setzePhase(Spielphase.GESAMTSTAND_AKTUALISIEREN);
        this.ergebnis = neuesErgebnis;
        this.solistAufspieler = null;
        return List.of();
    }

    public Spielregeln spielregeln() { return spielregeln; }
    public Spieltyp spieltyp() { return spieltyp; }
    public SpielerPosition geber() { return geber; }

    public Spielphase phase() {
        return switch (phaseText) {
            case "KARTEN_AUSTEILEN" -> Spielphase.KARTEN_AUSTEILEN;
            case "VORBEHALT_ANSAGE" -> Spielphase.VORBEHALT_ANSAGE;
            case "VORBEHALT_AUFLOESUNG" -> Spielphase.VORBEHALT_AUFLOESUNG;
            case "ARMUT_TAUSCH" -> new Spielphase.ArmutTausch(Objects.requireNonNull(armutStatus, "ARMUT_TAUSCH ohne ArmutStatus"));
            case "STICHPHASE" -> new Spielphase.Stichphase(rekonstruiereAktuellenStich(), pflichtAnsageAusstehend.alsSet(), hochzeitStatus);
            case "AUSWERTUNG" -> Spielphase.AUSWERTUNG;
            case "GESAMTSTAND_AKTUALISIEREN" -> Spielphase.GESAMTSTAND_AKTUALISIEREN;
            default -> throw new IllegalStateException("Unbekannte Phase: " + phaseText);
        };
    }

    public List<VorbehaltMeldung> vorbehalte() { return vorbehalte.meldungen(); }
    public Map<SpielerPosition, Hand> haende() { return haende.alsMap(); }
    public Hand handVon(SpielerPosition pos) { Objects.requireNonNull(pos); return haende.handVon(pos); }
    public List<Stich> abgeschlosseneStiche() { return abgeschlosseneStiche.stiche(); }
    public Optional<Stich> aktuellerStich() { return phase() instanceof Spielphase.Stichphase s ? Optional.of(s.aktuellerStich()) : Optional.empty(); }
    public Parteien parteien() { if (parteien == null) throw new IllegalStateException("Die Parteien sind erst nach der Vorbehaltsaufloesung bekannt"); return parteien; }
    public Partei parteiVon(SpielerPosition pos) { return parteien().parteiVon(pos); }
    public Ansagen ansagen() { return ansagen; }
    public Optional<Spielergebnis> ergebnis() { return Optional.ofNullable(ergebnis); }
    public Optional<HochzeitStatus> hochzeitStatus() { return phase() instanceof Spielphase.Stichphase s ? Optional.ofNullable(s.hochzeitStatus()) : Optional.empty(); }
    public Optional<ArmutStatus> armutStatus() { return phase() instanceof Spielphase.ArmutTausch a ? Optional.of(a.armutStatus()) : Optional.empty(); }
    public Set<Partei> pflichtansageAusstehend() { return phase() instanceof Spielphase.Stichphase s ? s.pflichtansageAusstehend() : Set.of(); }
    public TrumpfOrdnung trumpfOrdnung() { return effektiveTrumpfOrdnung(); }
    public boolean schweinchenAktiv() { return schweinchenAktivFlag; }

    /** Liefert die Position des Spielers, der das erste Karo-As gespielt hat (implizite Schweinchen-Meldung), oder leer. */
    public Optional<SpielerPosition> schweinchenGemeldetVon() {
        if (!schweinchenAktiv()) { return Optional.empty(); }
        for (Stich stich : abgeschlosseneStiche.stiche()) {
            for (GespielteKarte gk : stich.gespielteKarten()) {
                if (istKaroAs(gk.karte())) { return Optional.of(gk.spieler()); }
            }
        }
        return aktuellerStich().flatMap(stich -> stich.gespielteKarten().stream()
            .filter(gk -> istKaroAs(gk.karte())).findFirst().map(GespielteKarte::spieler));
    }

    public boolean hatHerzDurchgegangenenStich() { return abgeschlosseneStiche.stiche().stream().anyMatch(this::istHerzDurchgegangen); }
    public int einwurfZaehler() { return einwurfZaehler; }

    public int spielNummer() { return spielNummer; }
    public void setzeSpielNummer(int spielNummer) { this.spielNummer = spielNummer; }
    public String phasenName() { return phaseText; }

    /** Ersetzt die Haende aller Spieler (für Test-Setup und Integration-Tests). */
    public void ersetzeHaende(Map<SpielerPosition, Hand> neueHaende) {
        this.haende = Haende.aus(neueHaende);
    }

    /** Setzt das Spielergebnis direkt (für Test-Setup). */
    public void setzeErgebnis(Spielergebnis neuesErgebnis) {
        this.ergebnis = neuesErgebnis;
    }

    /** Setzt die Ansagen direkt (für Test-Setup). */
    public void setzeAnsagen(Ansagen neueAnsagen) {
        this.ansagen = neueAnsagen;
    }

    /** Prüft ohne Exception ob Parteien-Zuweisung bereits bekannt ist (z.B. nach DB-Laden). */
    public boolean hatParteien() { return parteien != null; }

    /** Setzt die abgeschlossenen Stiche (für Test-Setup). */
    public void setzeAbgeschlosseneStiche(List<Stich> stiche) {
        this.abgeschlosseneStiche = Stichverlauf.aus(stiche);
    }
    public SpielerPosition geberPositionDb() { return geber; }
    public Spieltyp spieltypAusDb() { return spieltyp; }
    public SpielErgebnisEmbeddable dbErgebnis() { return ergebnisEmbeddable(); }
    public SpielerPosition geberPosition() { return geber; }

    public SpielErgebnisEmbeddable ergebnisEmbeddable() {
        return ergebnis != null ? SpielErgebnisEmbeddable.aus(ergebnis) : null;
    }

    public List<HandJsonEintrag> haendeAlsJson() {
        return SpielerPosition.standardReihenfolge().stream()
            .filter(haende::enthaelt)
            .map(p -> HandJsonEintrag.aus(p, haende.handVon(p).karten()))
            .toList();
    }

    public List<StichJsonEintrag> sticheAlsJson() {
        List<StichJsonEintrag> res = new ArrayList<>();
        int idx = 1;
        for (Stich stich : abgeschlosseneStiche.stiche()) {
            res.add(new StichJsonEintrag(idx++, stich.aufspieler(), stich.gewinner(trumpfOrdnung()).spieler(),
                stich.augen().wert(), stich.gespielteKarten().stream().map(AktuellerStichKarteEmbeddable::aus).toList()));
        }
        return List.copyOf(res);
    }

    public List<AktuellerStichKarteEmbeddable> aktuellerStichKarten() {
        return aktuellerStich().map(stich -> stich.gespielteKarten().stream().map(AktuellerStichKarteEmbeddable::aus).toList()).orElse(List.of());
    }

    public List<SonderpunktJsonEintrag> sonderpunkteAlsJson() {
        if (ergebnis == null) {
            return List.of();
        }
        List<SonderpunktJsonEintrag> sonderpunkte = new ArrayList<>();
        for (Map.Entry<Partei, List<SonderpunktEreignis>> eintrag : ergebnis.sonderpunkteProPartei().entrySet()) {
            for (SonderpunktEreignis ereignis : eintrag.getValue()) {
                sonderpunkte.add(SonderpunktJsonEintrag.aus(eintrag.getKey(), ereignis));
            }
        }
        return List.copyOf(sonderpunkte);
    }

    public SpielerPosition aktuellerStichAufspielerPosition() { return aktuellerStich().map(Stich::aufspieler).orElse(null); }
    public List<VorbehaltMeldungEmbeddable> vorbehalteAlsEmbeddable() { return vorbehalte.meldungen().stream().map(e -> VorbehaltMeldungEmbeddable.neu(e.spielerPosition(), e.ansage())).toList(); }
    public List<AnsageEreignisEmbeddable> ansagenAlsEmbeddable() { return ansagen.ereignisse().stream().map(e -> AnsageEreignisEmbeddable.neu(e.spieler(), e.ansage())).toList(); }
    public SpielerPosition armutSpielerPositionDb() { return armutStatus != null ? armutStatus.armutSpieler() : null; }
    public int armutAktuellerAntwortIndexDb() { return armutStatus != null ? armutStatus.aktuellerIndex() : 0; }
    public boolean armutAngebotAbgegebenDb() { return armutStatus != null && armutStatus.angebotLiegtVor(); }
    public SpielerPosition armutPartnerSpielerPositionDb() { return armutStatus != null ? armutStatus.partner().orElse(null) : null; }
    public List<HandKarteEmbeddable> armutAngeboteneKartenDb() { return armutStatus != null ? armutStatus.angeboteneTrumpfkarten().stream().map(HandKarteEmbeddable::aus).toList() : List.of(); }
    public SpielerPosition hochzeitSpielerPositionDb() { return hochzeitStatus != null ? hochzeitStatus.hochzeitSpieler() : null; }
    public int hochzeitGeklaerteSticheDb() { return hochzeitStatus != null ? hochzeitStatus.geklaerteStiche() : 0; }
    public SpielerPosition hochzeitPartnerSpielerPositionDb() { return hochzeitStatus != null ? hochzeitStatus.partner().orElse(null) : null; }
    public boolean hochzeitStillesSoloDb() { return hochzeitStatus != null && hochzeitStatus.stillesSolo(); }
    public boolean schweinchenAktivFlag() { return schweinchenAktivFlag; }
    public List<String> pflichtansageAusstehendDb() { return pflichtAnsageAusstehend.alsSet().stream().map(Enum::name).toList(); }

    /** Ersetzt die Handverteilung des Spiels, z. B. fuer kontrollierte Persistenz-Setups in Tests. */
    public void setzeHaendeAusMap(Map<SpielerPosition, Hand> neueHaende) {
        Objects.requireNonNull(neueHaende, "neueHaende duerfen nicht null sein");
        this.haende = Haende.aus(neueHaende);
        this.kartendeck = null;
    }

    /** Wird vom {@code SpielNachLadenCallback} nach dem DB-Laden aufgerufen. */
    public void initialisierePersistenzDefaultsNachLaden() { }

    void setzePhase(Spielphase neuePhase) {
        Objects.requireNonNull(neuePhase, "phase darf nicht null sein");
        phaseText = neuePhase.name();
        if (neuePhase instanceof Spielphase.Stichphase stichphase) {
            aktuellerStich = stichphase.aktuellerStich();
            pflichtAnsageAusstehend = stichphase.pflichtansageAusstehend() == null || stichphase.pflichtansageAusstehend().isEmpty()
                ? PflichtAnsagen.leer()
                : PflichtAnsagen.aus(stichphase.pflichtansageAusstehend());
            hochzeitStatus = stichphase.hochzeitStatus();
            armutStatus = null;
        } else if (neuePhase instanceof Spielphase.ArmutTausch armutTausch) {
            armutStatus = armutTausch.armutStatus();
            aktuellerStich = null;
            pflichtAnsageAusstehend = PflichtAnsagen.leer();
            hochzeitStatus = null;
        } else {
            aktuellerStich = null;
            pflichtAnsageAusstehend = PflichtAnsagen.leer();
            hochzeitStatus = null;
            armutStatus = null;
        }
    }

    void setzeTrumpfOrdnung(TrumpfOrdnung neueTrumpfOrdnung) {
        this.trumpfOrdnung = Objects.requireNonNull(neueTrumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        this.trumpfOrdnungTyp = bestimmeTrumpfOrdnungTyp(neueTrumpfOrdnung);
        this.schweinchenAktivFlag = neueTrumpfOrdnung instanceof SchweinchenTrumpfOrdnung;
    }

    private void initialisierePersistenzDefaults() {
        if (phaseText == null) { phaseText = Spielphase.KARTEN_AUSTEILEN.name(); }
        if (spielregeln == null) { spielregeln = Spielregeln.standardRegeln(); }
        if (ansagen == null) { ansagen = Ansagen.leer(); }
        if (trumpfOrdnungTyp == null) { trumpfOrdnungTyp = bestimmeTrumpfOrdnungTypAusSpieltyp(); }
    }

    private TrumpfOrdnung effektiveTrumpfOrdnung() {
        if (trumpfOrdnung == null) {
            trumpfOrdnung = rekonstruiereTrumpfOrdnung();
        }
        return trumpfOrdnung;
    }

    private Kartendeck effektivesKartendeck() {
        if (kartendeck == null) {
            kartendeck = rekonstruiereKartendeck();
        }
        return kartendeck;
    }

    private TrumpfOrdnung rekonstruiereTrumpfOrdnung() {
        return switch (trumpfOrdnungTyp) {
            case "NORMAL" -> schweinchenAktivFlag ? new SchweinchenTrumpfOrdnung(spielregeln) : new NormaleTrumpfOrdnung(spielregeln);
            case "SOLO_DAME" -> new DamensoloTrumpfOrdnung();
            case "SOLO_BUBE" -> new BubensoloTrumpfOrdnung();
            case "SOLO_FLEISCHLOS" -> new FleischlosTrumpfOrdnung();
            case "SOLO_TRUMPF_HERZ" -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.HERZ, spielregeln);
            case "SOLO_TRUMPF_PIK" -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.PIK, spielregeln);
            case "SOLO_TRUMPF_KREUZ" -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.KREUZ, spielregeln);
            default -> throw new IllegalStateException("Unbekannter Trumpf-Ordnung-Typ: " + trumpfOrdnungTyp);
        };
    }

    private Kartendeck rekonstruiereKartendeck() {
        List<Karte> alleKarten = new ArrayList<>();
        haende.alsMap().values().forEach(hand -> alleKarten.addAll(hand.karten()));
        abgeschlosseneStiche.stiche().forEach(stich -> stich.gespielteKarten().forEach(karte -> alleKarten.add(karte.karte())));
        if (aktuellerStich != null) {
            aktuellerStich.gespielteKarten().forEach(karte -> alleKarten.add(karte.karte()));
        }
        if (phase() instanceof Spielphase.ArmutTausch armutTausch && armutTausch.armutStatus().partner().isEmpty()) {
            alleKarten.addAll(armutTausch.armutStatus().angeboteneTrumpfkarten());
        }
        return alleKarten.isEmpty() ? Kartendeck.neu(spielregeln).gemischt() : Kartendeck.ausKarten(alleKarten);
    }

    private Stich rekonstruiereAktuellenStich() {
        if (aktuellerStich != null) {
            return aktuellerStich;
        }
        return Stich.neu(abgeschlosseneStiche.istLeer() ? geber.naechsteImUhrzeigersinn() : abgeschlosseneStiche.letzter().gewinner(trumpfOrdnung()).spieler());
    }

    private String bestimmeTrumpfOrdnungTyp(TrumpfOrdnung ordnung) {
        if (ordnung instanceof SchweinchenTrumpfOrdnung || ordnung instanceof NormaleTrumpfOrdnung) {
            return "NORMAL";
        }
        if (ordnung instanceof DamensoloTrumpfOrdnung) {
            return "SOLO_DAME";
        }
        if (ordnung instanceof BubensoloTrumpfOrdnung) {
            return "SOLO_BUBE";
        }
        if (ordnung instanceof FleischlosTrumpfOrdnung) {
            return "SOLO_FLEISCHLOS";
        }
        if (ordnung instanceof VariableTrumpfsoloTrumpfOrdnung) {
            return switch (spieltyp) {
                case SOLO_TRUMPF_HERZ -> "SOLO_TRUMPF_HERZ";
                case SOLO_TRUMPF_PIK -> "SOLO_TRUMPF_PIK";
                case SOLO_TRUMPF_KREUZ -> "SOLO_TRUMPF_KREUZ";
                default -> throw new IllegalStateException("Variable Trumpf-Ordnung ohne passenden Spieltyp: " + spieltyp);
            };
        }
        throw new IllegalStateException("Unbekannte Trumpf-Ordnung: " + ordnung.getClass().getSimpleName());
    }

    private String bestimmeTrumpfOrdnungTypAusSpieltyp() {
        if (spieltyp == null) {
            return "NORMAL";
        }
        return switch (spieltyp) {
            case SOLO_DAME -> "SOLO_DAME";
            case SOLO_BUBE -> "SOLO_BUBE";
            case SOLO_FLEISCHLOS -> "SOLO_FLEISCHLOS";
            case SOLO_TRUMPF_HERZ -> "SOLO_TRUMPF_HERZ";
            case SOLO_TRUMPF_PIK -> "SOLO_TRUMPF_PIK";
            case SOLO_TRUMPF_KREUZ -> "SOLO_TRUMPF_KREUZ";
            default -> "NORMAL";
        };
    }

    private boolean istHerzDurchgegangen(Stich stich) {
        if (!stich.istVollstaendig()) return false;
        boolean alleFehlherz = stich.gespielteKarten().stream().allMatch(gk -> gk.karte().farbe() == Farbe.HERZ && !trumpfOrdnung().istTrumpf(gk.karte()));
        if (!alleFehlherz) return false;
        if (spielregeln.herzDurchgegangenNurHoch()) { return stich.gespielteKarten().stream().allMatch(gk -> gk.karte().wert() == Kartenwert.AS); }
        return true;
    }

    public int kartenProSpieler() { return effektivesKartendeck().karten().size() / SpielerPosition.standardReihenfolge().size(); }
    private <T extends Spielphase> void pruefePhase(Class<T> erw, String aktion) { Spielphase aktuellePhase = phase(); if (!erw.isInstance(aktuellePhase)) throw new SpielzugKonfliktException(aktion + " ist nur in Phase " + erw.getSimpleName() + " erlaubt, war aber " + aktuellePhase.name()); }

    private HochzeitFortschritt fortschrittNachVollstaendigemStich(Stich gs, HochzeitStatus ahs) {
        if (ahs == null || !ahs.suchtPartner()) { return new HochzeitFortschritt(parteien, ahs); }
        HochzeitStatus ns = ahs.mitGeklaertemStich(gs.gewinner(trumpfOrdnung()).spieler());
        if (ns.partner().isPresent()) { return new HochzeitFortschritt(parteien.mitPartei(ns.partner().orElseThrow(), Partei.RE).mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge()), ns); }
        if (ns.stillesSolo()) { return new HochzeitFortschritt(Parteien.ausSolo(ns.hochzeitSpieler()), ns); }
        return new HochzeitFortschritt(parteien, ns);
    }

    private static boolean istKaroAs(Karte k) { return k.farbe() == Farbe.KARO && k.wert() == Kartenwert.AS; }

    private record HochzeitFortschritt(Parteien parteien, HochzeitStatus status) {}
}
