package de.locodoko.partie;

import com.fasterxml.jackson.core.type.TypeReference;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.SchweinchenTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.karten.TrumpfOrdnung;
import de.locodoko.system.AbstraktePersistenzEntity;

import org.springframework.data.annotation.Transient;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Ein einzelnes Doppelkopf-Spiel innerhalb einer Partie.
 *
 * <p>Kapselt den vollstaendigen Spielzustand: aktive {@link Spielphase}, Haende aller Spieler,
 * bisherige Vorbehalte, Parteizuordnung, Ansage-Historie, abgeschlossene und laufende Stiche
 * sowie das Ergebnis nach der Auswertung. Sonderzustaende fuer Hochzeit und Armut werden
 * in eigenen Status-Value-Objects ({@link HochzeitStatus}, {@link ArmutStatus}) verwaltet.</p>
 *
 * <p>Zentraler Domain-Kern und Persistenz-Entity (@Table("spiel")). Die gesamte Spiellogik
 * (Stichvalidierung, Vorbehalt-Aufloesung, Ansage-Zeitfenster, Auswertung) liegt hier.
 * Jede Domain-Aktion liefert eine neue Spiel-Instanz via toBuilder().build(), wobei die
 * Persistenz-Identitaet uebernommen wird. Transiente Domain-Felder werden per
 * {@code hydriere()} aus den DB-Spalten rekonstruiert; {@code syncZuPersistenz()}
 * serialisiert den Domain-Zustand zurueck in die DB-Felder.</p>
 */
@Table("spiel")
public class Spiel extends AbstraktePersistenzEntity {

    // -- Domain-Felder (transient, nicht in DB; package-private fuer Helfer-Klassen) --

    @Transient Spielregeln spielregeln;
    @Transient Kartendeck kartendeck;
    @Transient TrumpfOrdnung trumpfOrdnung;
    @Transient Spieltyp spieltyp;
    @Transient SpielerPosition geber;
    @Transient Spielphase phase;
    @Transient Map<SpielerPosition, Hand> haende;
    @Transient List<VorbehaltMeldung> vorbehalte;
    @Transient Parteien parteien;
    @Transient Ansagen ansagen;
    @Transient List<Stich> abgeschlosseneStiche;
    @Transient Spielergebnis ergebnis;
    /** Position des Solisten aus dem vorherigen Spiel; bestimmt den ersten Aufspieler. */
    @Transient SpielerPosition solistAufspieler;
    /** Spieler die in diesem Spiel bereits geschmissen haben — dürfen kein zweites Mal schmeißen. */
    @Transient Set<SpielerPosition> bereitsGeschmissen = EnumSet.noneOf(SpielerPosition.class);
    /** Anzahl der Einwürfe (Schmeißen oder abgelehnte Armut) in diesem Spiel — für Einwurf-Bockrunden-Trigger. */
    @Transient int einwurfZaehler = 0;
    @Transient private int spielNummer;
    @Transient private Partie partieRef;

    // ── DB-Spalten (package-private fuer Helfer-Klassen) ────────────────────────
    @Column("geber_position") String geberPosition;
    @Column("spieltyp") String spieltypText;
    @Column("phase") String phaseText;
    @Column("vorbehalte") String vorbehalteJson;
    @Column("ansagen") String ansagenJson;
    @Column("armut_spieler_position") String armutSpielerPosition;
    @Column("armut_aktueller_antwort_index") int armutAktuellerAntwortIndex;
    @Column("armut_angebot_abgegeben") boolean armutAngebotAbgegeben;
    @Column("armut_partner_spieler_position") String armutPartnerSpielerPosition;
    @Column("armut_angebotene_karten") String armutAngeboteneKartenJson;
    @Column("hochzeit_spieler_position") String hochzeitSpielerPositionText;
    @Column("hochzeit_geklaerte_stiche") int hochzeitGeklaerteStiche;
    @Column("hochzeit_partner_spieler_position") String hochzeitPartnerSpielerPositionText;
    @Column("hochzeit_stilles_solo") boolean hochzeitStillesSolo;
    @Column("pflicht_ansage_ausstehend") String pflichtAnsageAusstehendJson = "[]";
    @Column("schweinchen_aktiv") boolean schweinchenAktivFlag;
    @Column("bereits_geschmissen_json") String bereitsGeschmisenJson = "[]";
    @Column("einwurf_zaehler") int einwurfZaehlerDb = 0;
    @Column("aktueller_stich_aufspieler_position") String aktuellerStichAufspielerPositionText;
    @Column("aktueller_stich_karten") String aktuellerStichKartenJson;
    @Column("re_augen") Integer reAugen;
    @Column("kontra_augen") Integer kontraAugen;
    @Column("sieger_partei") String siegerParteiText;
    @Column("spielwert") Integer spielwertPunkte;
    @Column("grundwert") Integer grundwertDb;
    @Column("absage_punkte") Integer absagePunkteDb;
    @Column("gegen_die_alten_punkte") Integer gegenDieAltenPunkteDb;
    @Column("solo_multiplikator") Integer soloMultiplikatorDb;
    @Column("spielpunkte_sued") Integer spielpunkteSued;
    @Column("spielpunkte_west") Integer spielpunkteWest;
    @Column("spielpunkte_nord") Integer spielpunkteNord;
    @Column("spielpunkte_ost") Integer spielpunkteOst;
    @Column("haende_json") String haendeJson;
    @Column("stiche_json") String sticheJson;
    @Column("sonderpunkte_json") String sonderpunkteJson = "[]";

    // -- Konstruktoren --

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
        this.trumpfOrdnung = Objects.requireNonNull(trumpfOrdnung, "trumpfOrdnung darf nicht null sein");
        this.spieltyp = Objects.requireNonNull(spieltyp, "spieltyp darf nicht null sein");
        this.geber = Objects.requireNonNull(geber, "geber darf nicht null sein");
        this.phase = Objects.requireNonNull(phase, "phase darf nicht null sein");
        this.haende = Map.copyOf(haende);
        this.vorbehalte = List.copyOf(vorbehalte);
        this.parteien = parteien;
        this.ansagen = Objects.requireNonNull(ansagen, "ansagen duerfen nicht null sein");
        this.abgeschlosseneStiche = List.copyOf(abgeschlosseneStiche);
        this.ergebnis = ergebnis;
        this.solistAufspieler = solistAufspieler;
    }

    // -- Statische Factory-Methoden --

    public static Spiel neu(SpielerPosition geber, Spielregeln spielregeln, Kartendeck kartendeck) {
        Objects.requireNonNull(geber, "geber darf nicht null sein");
        return new SpielBuilder().spielregeln(spielregeln).kartendeck(kartendeck)
            .trumpfOrdnung(new NormaleTrumpfOrdnung(spielregeln)).spieltyp(Spieltyp.NORMALSPIEL)
            .geber(geber).phase(Spielphase.KARTEN_AUSTEILEN).haende(Map.of()).vorbehalte(List.of())
            .parteien(null).ansagen(Ansagen.leer()).abgeschlosseneStiche(List.of())
            .ergebnis(null).solistAufspieler(null).build();
    }

    /** Wie {@link #neu}, aber der Solist des vorherigen Spiels erhaelt das Anspielrecht. */
    public static Spiel neuMitSolistAufspieler(SpielerPosition geber, SpielerPosition solistAufspieler, Spielregeln spielregeln, Kartendeck kartendeck) {
        Objects.requireNonNull(geber, "geber darf nicht null sein");
        Objects.requireNonNull(solistAufspieler, "solistAufspieler darf nicht null sein");
        return new SpielBuilder().spielregeln(spielregeln).kartendeck(kartendeck)
            .trumpfOrdnung(new NormaleTrumpfOrdnung(spielregeln)).spieltyp(Spieltyp.NORMALSPIEL)
            .geber(geber).phase(Spielphase.KARTEN_AUSTEILEN).haende(Map.of()).vorbehalte(List.of())
            .parteien(null).ansagen(Ansagen.leer()).abgeschlosseneStiche(List.of())
            .ergebnis(null).solistAufspieler(solistAufspieler).build();
    }

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

    public static Spiel ausPersistiertemStand(
        Spielregeln spielregeln, Kartendeck kartendeck, Spieltyp spieltyp,
        SpielerPosition geber, Spielphase phase, Map<SpielerPosition, Hand> haende,
        List<VorbehaltMeldung> vorbehalte, Parteien parteien, Ansagen ansagen,
        List<Stich> abgeschlosseneStiche, Spielergebnis ergebnis,
        boolean schweinchenAktiv, SpielerPosition solistAufspieler, int einwurfZaehler
    ) {
        return new SpielBuilder().spielregeln(spielregeln).kartendeck(kartendeck)
            .trumpfOrdnung(SpielVorbehaltAufloesung.trumpfOrdnungFuerPersistiertenStand(spielregeln, spieltyp, schweinchenAktiv))
            .spieltyp(spieltyp).geber(geber).phase(phase).haende(haende).vorbehalte(vorbehalte)
            .parteien(parteien).ansagen(ansagen).abgeschlosseneStiche(abgeschlosseneStiche)
            .ergebnis(ergebnis).solistAufspieler(solistAufspieler).einwurfZaehler(einwurfZaehler).build();
    }

    /** Erstellt eine minimale Persistenz-Entity ohne Domain-Felder. */
    public static Spiel neuePersistenz(int spielNummer, SpielerPosition geberPosition, Spieltyp spieltyp, Spielphase phase) {
        Spiel spiel = new Spiel();
        spiel.spielNummer = spielNummer;
        spiel.geberPosition = geberPosition.name();
        spiel.spieltypText = spieltyp.name();
        spiel.phaseText = phase.name();
        spiel.haendeJson = "[]";
        spiel.sticheJson = "[]";
        return spiel;
    }

    public static Map<SpielerPosition, Integer> gewonneneStiche(Spiel spiel) {
        EnumMap<SpielerPosition, Integer> map = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) { map.put(pos, 0); }
        spiel.sticheAlsJson().forEach(s -> map.merge(s.gewinnerPosition(), 1, Integer::sum));
        return Map.copyOf(map);
    }

    // -- Domain-Aktionen --

    public List<SpielEreignis> teileKartenAus() {
        pruefePhase(Spielphase.KartenAusteilen.class, "Karten austeilen");
        Map<SpielerPosition, Hand> neueHaende = SpielVorbehaltAufloesung.haendeAusDeck(kartendeck);
        this.trumpfOrdnung = SpielVorbehaltAufloesung.hatSchweinchen(spielregeln, neueHaende)
            ? new SchweinchenTrumpfOrdnung(spielregeln) : trumpfOrdnung;
        this.phase = Spielphase.VORBEHALT_ANSAGE;
        this.haende = neueHaende;
        this.vorbehalte = List.of();
        this.parteien = null;
        this.ergebnis = null;
        return List.of();
    }

    public Optional<SpielerPosition> naechsterVorbehaltSpieler() {
        if (!(phase instanceof Spielphase.VorbehaltAnsage) || vorbehalte.size() >= SpielerPosition.standardReihenfolge().size()) { return Optional.empty(); }
        return Optional.of(SpielerPosition.imUhrzeigersinnAb(geber.naechsteImUhrzeigersinn()).get(vorbehalte.size()));
    }

    public List<SpielEreignis> meldeGesund(SpielerPosition spielerPosition) { return meldeVorbehalt(spielerPosition, VorbehaltAnsage.GESUND); }

    public List<SpielEreignis> meldeVorbehalt(SpielerPosition spielerPosition, VorbehaltAnsage vorbehaltAnsage) {
        pruefePhase(Spielphase.VorbehaltAnsage.class, "Gesund melden");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(vorbehaltAnsage, "vorbehaltAnsage darf nicht null sein");
        SpielerPosition erwarteterSpieler = naechsterVorbehaltSpieler().orElseThrow(() -> new IllegalStateException("Es werden keine Vorbehalte mehr erwartet"));
        if (spielerPosition != erwarteterSpieler) { throw new IllegalStateException("Vorbehalte muessen in Sitzreihenfolge gemeldet werden; erwartet: " + erwarteterSpieler); }
        if (vorbehaltAnsage.istSchmeissen() && bereitsGeschmissen.contains(spielerPosition)) { throw new IllegalStateException("Spieler " + spielerPosition + " hat das Schmeiss-Recht in diesem Spiel bereits genutzt"); }
        if (!vorbehaltAnsage.istZulaessig(handVon(spielerPosition), spielregeln)) { throw new IllegalStateException("Vorbehalt " + vorbehaltAnsage + " ist fuer " + spielerPosition + " nach den Spielregeln nicht zulaessig"); }
        List<VorbehaltMeldung> neueVorbehalte = new ArrayList<>(vorbehalte);
        neueVorbehalte.add(new VorbehaltMeldung(spielerPosition, vorbehaltAnsage));
        Spielphase naechstePhase = neueVorbehalte.size() == SpielerPosition.standardReihenfolge().size() ? Spielphase.VORBEHALT_AUFLOESUNG : Spielphase.VORBEHALT_ANSAGE;
        this.bereitsGeschmissen = vorbehaltAnsage.istSchmeissen() ? addToSet(bereitsGeschmissen, spielerPosition) : bereitsGeschmissen;
        this.phase = naechstePhase;
        this.vorbehalte = neueVorbehalte;
        return List.of();
    }

    public List<SpielEreignis> loeseVorbehalteAuf() {
        pruefePhase(Spielphase.VorbehaltAufloesung.class, "Vorbehalte aufloesen");
        SpielVorbehaltAufloesung.aufloesen(this, vorbehalte, trumpfOrdnung,
            spielregeln, haende, geber, solistAufspieler, kartendeck, einwurfZaehler);
        return List.of();
    }

    public List<SpielEreignis> legeArmutTrumpfkarten(SpielerPosition spielerPosition, List<Karte> angeboteneTrumpfkarten) {
        if (!(phase instanceof Spielphase.ArmutTausch armutTauschPhase)) { throw new IllegalStateException("Armut-Karten anbieten ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + phase.name()); }
        SpielArmutTausch.legeArmutTrumpfkarten(this, spielerPosition,
            angeboteneTrumpfkarten, armutTauschPhase.armutStatus(), handVon(spielerPosition), trumpfOrdnung, haende);
        return List.of();
    }

    public List<SpielEreignis> lehneArmutAb(SpielerPosition spielerPosition) {
        if (!(phase instanceof Spielphase.ArmutTausch armutTauschPhase)) { throw new IllegalStateException("Armut ablehnen ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + phase.name()); }
        SpielArmutTausch.lehneArmutAb(this, spielerPosition,
            armutTauschPhase.armutStatus(), spielregeln, geber, einwurfZaehler, kartendeck);
        return List.of();
    }

    public List<SpielEreignis> nimmArmutAn(SpielerPosition spielerPosition, List<Karte> rueckgabekarten) {
        if (!(phase instanceof Spielphase.ArmutTausch armutTauschPhase)) { throw new IllegalStateException("Armut annehmen ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + phase.name()); }
        SpielArmutTausch.nimmArmutAn(this, spielerPosition, rueckgabekarten,
            armutTauschPhase.armutStatus(), solistAufspieler, geber, haende, spielregeln, trumpfOrdnung, parteien);
        return List.of();
    }

    public Optional<SpielerPosition> aktuellerSpieler() {
        return phase instanceof Spielphase.Stichphase s ? Optional.of(s.aktuellerStich().erwarteterSpieler()) : Optional.empty();
    }

    public Optional<SpielerPosition> erwarteterSpieler() {
        return switch (phase) {
            case Spielphase.VorbehaltAnsage _ -> naechsterVorbehaltSpieler();
            case Spielphase.ArmutTausch at -> { ArmutStatus st = at.armutStatus(); yield st.angebotLiegtVor() ? st.aktuellerAntwortspieler() : Optional.of(st.armutSpieler()); }
            case Spielphase.Stichphase _ -> aktuellerSpieler();
            default -> Optional.empty();
        };
    }

    public List<Karte> gueltigeKartenFuer(SpielerPosition spielerPosition) {
        if (!(phase instanceof Spielphase.Stichphase stichphase)) { throw new IllegalStateException("gueltige Karten abfragen ist nur in Phase STICHPHASE erlaubt, war aber " + phase.name()); }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        SpielerPosition erw = aktuellerSpieler().orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen erwarteten Spieler"));
        if (spielerPosition != erw) { throw new IllegalStateException("Gueltige Karten koennen nur fuer den aktuellen Spieler abgefragt werden; erwartet: " + erw); }
        return stichphase.aktuellerStich().gueltigeKarten(handVon(spielerPosition), trumpfOrdnung);
    }

    public List<SpielEreignis> spieleKarte(SpielerPosition spielerPosition, Karte karte) {
        if (!(phase instanceof Spielphase.Stichphase stichphase)) { throw new IllegalStateException("Karte spielen ist nur in Phase STICHPHASE erlaubt, war aber " + phase.name()); }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(karte, "karte darf nicht null sein");
        if (!stichphase.pflichtansageAusstehend().isEmpty()) { throw new IllegalStateException("Karte spielen ist erst erlaubt wenn alle ausstehenden Pflichtansagen gemacht wurden: " + stichphase.pflichtansageAusstehend()); }

        boolean schweinchenVorherGemeldet = schweinchenGemeldetVon().isPresent();
        Hand hand = handVon(spielerPosition);
        Stich gespielterStich = stichphase.aktuellerStich().spieleKarte(spielerPosition, karte, hand, trumpfOrdnung);
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende();
        neueHaende.put(spielerPosition, hand.ohne(karte));

        List<SpielEreignis> ereignisse = new ArrayList<>();
        ereignisse.add(new SpielEreignis.KarteGespielt(spielerPosition, karte));

        if (!schweinchenVorherGemeldet && istKaroAs(karte) && schweinchenAktiv()) {
            ereignisse.add(new SpielEreignis.SchweinchenGemeldet(spielerPosition));
        }

        if (!gespielterStich.istVollstaendig()) {
            this.haende = neueHaende;
            this.phase = new Spielphase.Stichphase(gespielterStich, stichphase.pflichtansageAusstehend(), stichphase.hochzeitStatus());
            return List.copyOf(ereignisse);
        }
        List<Stich> neueAbgeschlosseneStiche = new ArrayList<>(abgeschlosseneStiche);
        neueAbgeschlosseneStiche.add(gespielterStich);
        HochzeitStatus alterHochzeitStatus = stichphase.hochzeitStatus();
        HochzeitFortschritt hf = fortschrittNachVollstaendigemStich(gespielterStich, alterHochzeitStatus);

        if (alterHochzeitStatus != null && alterHochzeitStatus.suchtPartner() && hf.status() != null && !hf.status().suchtPartner() && hf.status().partner().isPresent()) {
            ereignisse.add(new SpielEreignis.HochzeitPartnerGefunden(hf.status().partner().get()));
        }

        Set<Partei> neuesPflichtansageAusstehend = berechneNeuePflichtansagen(gespielterStich, neueAbgeschlosseneStiche.size(), hf.parteien());
        List<SonderpunktEreignis> sonderpunkte = new SonderpunktBewerter()
            .bewerte(List.of(gespielterStich), hf.parteien(), trumpfOrdnung, spielregeln, neueAbgeschlosseneStiche.size() - 1)
            .values().stream().flatMap(List::stream).toList();
        ereignisse.add(new SpielEreignis.StichAbgeschlossenEreignis(gespielterStich, sonderpunkte));

        this.haende = neueHaende;
        this.abgeschlosseneStiche = neueAbgeschlosseneStiche;
        this.parteien = hf.parteien();
        this.solistAufspieler = null;

        if (neueAbgeschlosseneStiche.size() == kartenProSpieler()) {
            this.phase = Spielphase.AUSWERTUNG;
            return List.copyOf(ereignisse);
        }
        Stich naechsterStich = Stich.neu(gespielterStich.naechsterAufspieler(trumpfOrdnung));
        this.phase = new Spielphase.Stichphase(naechsterStich, neuesPflichtansageAusstehend, hf.status());
        return List.copyOf(ereignisse);
    }

    private Set<Partei> berechneNeuePflichtansagen(Stich abgeschlossenerStich, int stichNummer, Parteien aktuelleParteien) {
        if (!spielregeln.dreissigAugenPflichtAktiv() || stichNummer > 2) { return Set.of(); }
        if (spieltyp != Spieltyp.NORMALSPIEL && spieltyp != Spieltyp.HOCHZEIT) { return Set.of(); }
        if (!abgeschlossenerStich.augen().ueberschreitet(30)) { return Set.of(); }
        Partei gp = aktuelleParteien.parteiVon(abgeschlossenerStich.gewinner(trumpfOrdnung).spieler());
        if (ansagen.hatGrundansage(gp, aktuelleParteien)) { return Set.of(); }
        return Set.copyOf(EnumSet.of(gp));
    }

    public boolean kannAnsagen(SpielerPosition spielerPosition, Ansage ansage) {
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        if (!(phase instanceof Spielphase.Stichphase stichphase)) { return false; }
        if (spielerPosition != stichphase.aktuellerStich().erwarteterSpieler()) { return false; }
        if (stichphase.hochzeitStatus() != null && stichphase.hochzeitStatus().suchtPartner() && spielerPosition != stichphase.hochzeitStatus().hochzeitSpieler()) { return false; }
        return ansagen.kannAnsagen(spielerPosition, ansage, parteien(), spielregeln, effektiveKartenAnzahlFuer(spielerPosition, ansage, stichphase.pflichtansageAusstehend()));
    }

    public List<SpielEreignis> sageAn(SpielerPosition spielerPosition, Ansage ansage) {
        if (!(phase instanceof Spielphase.Stichphase stichphase)) { throw new IllegalStateException("Ansage taetigen ist nur in Phase STICHPHASE erlaubt, war aber " + phase.name()); }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
        SpielerPosition erw = aktuellerSpieler().orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen erwarteten Spieler"));
        if (spielerPosition != erw) { throw new IllegalStateException("Ansagen duerfen nur vom aktuellen Spieler kommen; erwartet: " + erw); }
        if (stichphase.hochzeitStatus() != null && stichphase.hochzeitStatus().suchtPartner() && spielerPosition != stichphase.hochzeitStatus().hochzeitSpieler()) { throw new IllegalStateException("Vor der Klaerung der Hochzeit darf nur der Hochzeits-Spieler Ansagen taetigen"); }
        Ansagen neueAnsagen = ansagen.fuegeHinzu(spielerPosition, ansage, parteien(), spielregeln, effektiveKartenAnzahlFuer(spielerPosition, ansage, stichphase.pflichtansageAusstehend()));
        Parteien aktualisierteParteien = ansage.istGrundansage() ? parteien.mitOffenenParteienFuerAlle(List.of(spielerPosition)) : parteien;
        Set<Partei> aktualisiertesPflichtansageAusstehend = stichphase.pflichtansageAusstehend();
        if (ansage.istGrundansage() && !stichphase.pflichtansageAusstehend().isEmpty()) {
            Partei partei = parteien.parteiVon(spielerPosition);
            if (stichphase.pflichtansageAusstehend().contains(partei)) { EnumSet<Partei> m = EnumSet.copyOf(stichphase.pflichtansageAusstehend()); m.remove(partei); aktualisiertesPflichtansageAusstehend = m.isEmpty() ? Set.of() : Set.copyOf(m); }
        }
        this.parteien = aktualisierteParteien;
        this.ansagen = neueAnsagen;
        this.phase = new Spielphase.Stichphase(stichphase.aktuellerStich(), aktualisiertesPflichtansageAusstehend, stichphase.hochzeitStatus());
        this.solistAufspieler = null;
        return List.of();
    }

    private int effektiveKartenAnzahlFuer(SpielerPosition pos, Ansage ansage, Set<Partei> pflichtansageAusstehend) {
        Partei partei = parteien().parteiVon(pos);
        return (!pflichtansageAusstehend.isEmpty() && pflichtansageAusstehend.contains(partei) && ansage.istGrundansage()) ? Integer.MAX_VALUE : handVon(pos).karten().size();
    }

    public List<SpielEreignis> werteAus() {
        pruefePhase(Spielphase.Auswertung.class, "Spiel auswerten");
        Spielergebnis neuesErgebnis = new PunkteRechner().berechneNormalspielErgebnis(abgeschlosseneStiche, parteien(), trumpfOrdnung, ansagen, spielregeln);
        this.phase = Spielphase.GESAMTSTAND_AKTUALISIEREN;
        this.ergebnis = neuesErgebnis;
        this.solistAufspieler = null;
        return List.of();
    }

    // -- Domain-Getter --

    public Spielregeln spielregeln() { return spielregeln; }
    public Spieltyp spieltyp() { return spieltyp; }
    public SpielerPosition geber() { return geber; }
    public Spielphase phase() { return phase; }
    public List<VorbehaltMeldung> vorbehalte() { return vorbehalte; }
    public Map<SpielerPosition, Hand> haende() { return haende; }
    public Hand handVon(SpielerPosition pos) { Objects.requireNonNull(pos); Hand h = haende.get(pos); if (h == null) throw new IllegalArgumentException("Es gibt keine Hand fuer " + pos); return h; }
    public List<Stich> abgeschlosseneStiche() { return abgeschlosseneStiche; }
    public Optional<Stich> aktuellerStich() { return phase instanceof Spielphase.Stichphase s ? Optional.of(s.aktuellerStich()) : Optional.empty(); }
    public Parteien parteien() { if (parteien == null) throw new IllegalStateException("Die Parteien sind erst nach der Vorbehaltsaufloesung bekannt"); return parteien; }
    public Ansagen ansagen() { return ansagen; }
    public Optional<Spielergebnis> ergebnis() { return Optional.ofNullable(ergebnis); }
    public Optional<HochzeitStatus> hochzeitStatus() { return phase instanceof Spielphase.Stichphase s ? Optional.ofNullable(s.hochzeitStatus()) : Optional.empty(); }
    public Optional<ArmutStatus> armutStatus() { return phase instanceof Spielphase.ArmutTausch a ? Optional.of(a.armutStatus()) : Optional.empty(); }
    public Set<Partei> pflichtansageAusstehend() { return phase instanceof Spielphase.Stichphase s ? s.pflichtansageAusstehend() : Set.of(); }
    public TrumpfOrdnung trumpfOrdnung() { return trumpfOrdnung; }
    public boolean schweinchenAktiv() { return trumpfOrdnung instanceof SchweinchenTrumpfOrdnung; }

    /** Liefert die Position des Spielers, der das erste Karo-As gespielt hat (implizite Schweinchen-Meldung), oder leer. */
    public Optional<SpielerPosition> schweinchenGemeldetVon() {
        if (!schweinchenAktiv()) { return Optional.empty(); }
        for (Stich stich : abgeschlosseneStiche) {
            for (GespielteKarte gk : stich.gespielteKarten()) {
                if (istKaroAs(gk.karte())) { return Optional.of(gk.spieler()); }
            }
        }
        return aktuellerStich().flatMap(stich -> stich.gespielteKarten().stream()
            .filter(gk -> istKaroAs(gk.karte())).findFirst().map(GespielteKarte::spieler));
    }

    public boolean hatHerzDurchgegangenenStich() { return abgeschlosseneStiche.stream().anyMatch(this::istHerzDurchgegangen); }
    public int einwurfZaehler() { return einwurfZaehler; }

    // -- Persistenz-Accessor-Methoden --

    public int spielNummer() { return spielNummer; }
    public void setzeSpielNummer(int spielNummer) { this.spielNummer = spielNummer; }
    public void setzePartieRef(Partie partieRef) { this.partieRef = partieRef; }
    public Partie partieRef() { return partieRef; }
    public String phasenName() { return phaseText; }
    public SpielerPosition geberPositionDb() { return geberPosition != null ? SpielerPosition.valueOf(geberPosition) : null; }
    public Spieltyp spieltypAusDb() { return Spieltyp.valueOf(spieltypText); }

    /** DB-Ergebnis-Zugriff (Alias fuer ergebnisEmbeddable). */
    public SpielErgebnisEmbeddable dbErgebnis() { return ergebnisEmbeddable(); }

    /** DB-Geber-Position (Alias fuer geberPositionDb). */
    public SpielerPosition geberPosition() { return geberPositionDb(); }

    public SpielErgebnisEmbeddable ergebnisEmbeddable() {
        if (reAugen == null && kontraAugen == null && siegerParteiText == null) { return null; }
        SpielErgebnisEmbeddable e = new SpielErgebnisEmbeddable();
        e.setReAugen(reAugen); e.setKontraAugen(kontraAugen); e.setSiegerPartei(siegerParteiText);
        e.setSpielwert(spielwertPunkte); e.setGrundwert(grundwertDb); e.setAbsagePunkte(absagePunkteDb);
        e.setGegenDieAltenPunkte(gegenDieAltenPunkteDb); e.setSoloMultiplikator(soloMultiplikatorDb);
        e.setSpielpunkteSued(spielpunkteSued); e.setSpielpunkteWest(spielpunkteWest);
        e.setSpielpunkteNord(spielpunkteNord); e.setSpielpunkteOst(spielpunkteOst);
        return e;
    }

    public List<HandJsonEintrag> haendeAlsJson() { return JsonKonverter.liesList(haendeJson, new TypeReference<>() {}); }
    public List<StichJsonEintrag> sticheAlsJson() { return JsonKonverter.liesList(sticheJson, new TypeReference<>() {}); }
    public List<AktuellerStichKarteEmbeddable> aktuellerStichKarten() { return JsonKonverter.liesList(aktuellerStichKartenJson, new TypeReference<>() {}); }
    public List<SonderpunktJsonEintrag> sonderpunkteAlsJson() { return JsonKonverter.liesList(sonderpunkteJson, new TypeReference<>() {}); }
    public SpielerPosition aktuellerStichAufspielerPosition() { return aktuellerStichAufspielerPositionText != null ? SpielerPosition.valueOf(aktuellerStichAufspielerPositionText) : null; }
    public List<VorbehaltMeldungEmbeddable> vorbehalteAlsEmbeddable() { return JsonKonverter.liesList(vorbehalteJson, new TypeReference<>() {}); }
    public List<AnsageEreignisEmbeddable> ansagenAlsEmbeddable() { return JsonKonverter.liesList(ansagenJson, new TypeReference<>() {}); }
    public SpielerPosition armutSpielerPositionDb() { return armutSpielerPosition != null ? SpielerPosition.valueOf(armutSpielerPosition) : null; }
    public int armutAktuellerAntwortIndexDb() { return armutAktuellerAntwortIndex; }
    public boolean armutAngebotAbgegebenDb() { return armutAngebotAbgegeben; }
    public SpielerPosition armutPartnerSpielerPositionDb() { return armutPartnerSpielerPosition != null ? SpielerPosition.valueOf(armutPartnerSpielerPosition) : null; }
    public List<HandKarteEmbeddable> armutAngeboteneKartenDb() { return JsonKonverter.liesList(armutAngeboteneKartenJson, new TypeReference<>() {}); }
    public SpielerPosition hochzeitSpielerPositionDb() { return hochzeitSpielerPositionText != null ? SpielerPosition.valueOf(hochzeitSpielerPositionText) : null; }
    public int hochzeitGeklaerteSticheDb() { return hochzeitGeklaerteStiche; }
    public SpielerPosition hochzeitPartnerSpielerPositionDb() { return hochzeitPartnerSpielerPositionText != null ? SpielerPosition.valueOf(hochzeitPartnerSpielerPositionText) : null; }
    public boolean hochzeitStillesSoloDb() { return hochzeitStillesSolo; }
    public boolean schweinchenAktivFlag() { return schweinchenAktivFlag; }
    public List<String> pflichtansageAusstehendDb() { return JsonKonverter.liesList(pflichtAnsageAusstehendJson, new TypeReference<>() {}); }

    // -- DB-Mutations-Methoden (fuer Tests und Persistenz-Setup) --

    public void fuegeHandHinzu(HandJsonEintrag hand) {
        Objects.requireNonNull(hand, "hand darf nicht null sein");
        List<HandJsonEintrag> aktuelleHaende = new ArrayList<>(haendeAlsJson());
        aktuelleHaende.removeIf(h -> h.spielerPosition() == hand.spielerPosition());
        aktuelleHaende.add(hand);
        this.haendeJson = JsonKonverter.schreibeAlsJson(aktuelleHaende);
    }

    public void ersetzeHaende(List<HandJsonEintrag> neueHaende) {
        Objects.requireNonNull(neueHaende, "neueHaende duerfen nicht null sein");
        this.haendeJson = JsonKonverter.schreibeAlsJson(neueHaende);
    }

    public void fuegeStichHinzu(StichJsonEintrag stich) {
        Objects.requireNonNull(stich, "stich darf nicht null sein");
        List<StichJsonEintrag> aktuelleStiche = new ArrayList<>(sticheAlsJson());
        aktuelleStiche.add(stich);
        this.sticheJson = JsonKonverter.schreibeAlsJson(aktuelleStiche);
    }

    public void uebernehmeErgebnis(Spielergebnis spielergebnis) {
        Objects.requireNonNull(spielergebnis, "spielergebnis darf nicht null sein");
        SpielErgebnisEmbeddable erg = SpielErgebnisEmbeddable.aus(spielergebnis);
        this.reAugen = erg.reAugen(); this.kontraAugen = erg.kontraAugen();
        this.siegerParteiText = erg.siegerPartei() != null ? erg.siegerPartei().name() : null;
        this.spielwertPunkte = erg.spielwert();
        this.spielpunkteSued = erg.spielpunkteSued(); this.spielpunkteWest = erg.spielpunkteWest();
        this.spielpunkteNord = erg.spielpunkteNord(); this.spielpunkteOst = erg.spielpunkteOst();
        List<SonderpunktJsonEintrag> sonderpunkte = new ArrayList<>();
        for (Map.Entry<Partei, List<SonderpunktEreignis>> eintrag : spielergebnis.sonderpunkteProPartei().entrySet()) {
            for (SonderpunktEreignis ereignis : eintrag.getValue()) {
                sonderpunkte.add(SonderpunktJsonEintrag.aus(eintrag.getKey(), ereignis));
            }
        }
        this.sonderpunkteJson = JsonKonverter.schreibeAlsJson(sonderpunkte);
    }

    public void ersetzeAnsagen(List<AnsageEreignisEmbeddable> neueAnsagen) {
        Objects.requireNonNull(neueAnsagen, "neueAnsagen duerfen nicht null sein");
        this.ansagenJson = JsonKonverter.schreibeAlsJson(neueAnsagen);
    }

    public void setzeAktuellenStich(SpielerPosition aufspielerPosition, List<AktuellerStichKarteEmbeddable> neueKarten) {
        this.aktuellerStichAufspielerPositionText = aufspielerPosition != null ? aufspielerPosition.name() : null;
        this.aktuellerStichKartenJson = JsonKonverter.schreibeAlsJson(
            Objects.requireNonNull(neueKarten, "neueKarten duerfen nicht null sein"));
    }

    public void setzeHochzeitStatus(SpielerPosition spielerPosition, int geklaerteStiche, SpielerPosition partnerPosition, boolean stillesSolo) {
        this.hochzeitSpielerPositionText = spielerPosition != null ? spielerPosition.name() : null;
        this.hochzeitGeklaerteStiche = geklaerteStiche;
        this.hochzeitPartnerSpielerPositionText = partnerPosition != null ? partnerPosition.name() : null;
        this.hochzeitStillesSolo = stillesSolo;
    }

    // -- Hydrierung: DB-Felder -> Domain-Felder --

    public void hydriere(Spielregeln spielregeln) { hydriere(spielregeln, null); }

    public void hydriere(Spielregeln spielregeln, SpielerPosition solistDesLetztenSpiels) {
        Objects.requireNonNull(spielregeln, "spielregeln darf nicht null sein");
        SpielHydrierer.hydriere(this, spielregeln, solistDesLetztenSpiels);
    }

    // -- Sync: Domain-Felder -> DB-Felder --

    public void syncZuPersistenz() { SpielPersistenzSync.sync(this); }

    // -- Domain-Stand-Uebernahme --

    public void uebernehmeDomainStand(Spiel quelle) {
        spielregeln = quelle.spielregeln; kartendeck = quelle.kartendeck; trumpfOrdnung = quelle.trumpfOrdnung;
        spieltyp = quelle.spieltyp; geber = quelle.geber; phase = quelle.phase; haende = quelle.haende;
        vorbehalte = quelle.vorbehalte; parteien = quelle.parteien; ansagen = quelle.ansagen;
        abgeschlosseneStiche = quelle.abgeschlosseneStiche; ergebnis = quelle.ergebnis; solistAufspieler = quelle.solistAufspieler;
        bereitsGeschmissen = quelle.bereitsGeschmissen;
        einwurfZaehler = quelle.einwurfZaehler;
        syncZuPersistenz();
    }

    // -- Private Hilfsmethoden --

    private boolean istHerzDurchgegangen(Stich s) {
        if (!s.istVollstaendig()) return false;
        boolean alleFehlherz = s.gespielteKarten().stream().allMatch(gk -> gk.karte().farbe() == Farbe.HERZ && !trumpfOrdnung.istTrumpf(gk.karte()));
        if (!alleFehlherz) return false;
        if (spielregeln.herzDurchgegangenNurHoch()) { return s.gespielteKarten().stream().allMatch(gk -> gk.karte().wert() == Kartenwert.AS); }
        return true;
    }

    private Set<SpielerPosition> addToSet(Set<SpielerPosition> set, SpielerPosition pos) {
        EnumSet<SpielerPosition> copy = set.isEmpty() ? EnumSet.noneOf(SpielerPosition.class) : EnumSet.copyOf(set);
        copy.add(pos);
        return Set.copyOf(copy);
    }

    private Map<SpielerPosition, Hand> kopiereHaende() { EnumMap<SpielerPosition, Hand> k = new EnumMap<>(SpielerPosition.class); k.putAll(haende); return k; }
    public int kartenProSpieler() { return kartendeck.karten().size() / SpielerPosition.standardReihenfolge().size(); }
    private <T extends Spielphase> void pruefePhase(Class<T> erw, String aktion) { if (!erw.isInstance(phase)) throw new IllegalStateException(aktion + " ist nur in Phase " + erw.getSimpleName() + " erlaubt, war aber " + phase.name()); }

    private HochzeitFortschritt fortschrittNachVollstaendigemStich(Stich gs, HochzeitStatus ahs) {
        if (ahs == null || !ahs.suchtPartner()) { return new HochzeitFortschritt(parteien, ahs); }
        HochzeitStatus ns = ahs.mitGeklaertemStich(gs.gewinner(trumpfOrdnung).spieler());
        if (ns.partner().isPresent()) { return new HochzeitFortschritt(parteien.mitPartei(ns.partner().orElseThrow(), Partei.RE).mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge()), ns); }
        if (ns.stillesSolo()) { return new HochzeitFortschritt(Parteien.ausSolo(ns.hochzeitSpieler()), ns); }
        return new HochzeitFortschritt(parteien, ns);
    }

    private long anzahlTruepfe(Hand h) { return h.karten().stream().filter(trumpfOrdnung::istTrumpf).count(); }
    private static boolean istKaroAs(Karte k) { return k.farbe() == Farbe.KARO && k.wert() == Kartenwert.AS; }

    // Package-private Setter fuer SpielBuilder
    void setzeBereitsGeschmissen(Set<SpielerPosition> bereitsGeschmissen) { this.bereitsGeschmissen = bereitsGeschmissen; }
    void setzeEinwurfZaehler(int einwurfZaehler) { this.einwurfZaehler = einwurfZaehler; }
    void setPersistenceId(UUID persistenceId) { setzeId(persistenceId); }
    void setPersistenceErstelltAm(Instant erstelltAm) { setzeErstelltAm(erstelltAm); }
    void setPersistenceAktualisiertAm(Instant aktualisiertAm) { setzeAktualisiertAm(aktualisiertAm); }
    void markiereAlsGeladenInternal() { markiereAlsGeladen(); }

    private record HochzeitFortschritt(Parteien parteien, HochzeitStatus status) {}
}
