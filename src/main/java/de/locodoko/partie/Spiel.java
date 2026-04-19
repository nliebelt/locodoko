package de.locodoko.partie;

import com.fasterxml.jackson.core.type.TypeReference;
import de.locodoko.karten.Augen;
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
import de.locodoko.karten.VariableTrumpfsoloTrumpfOrdnung;
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

    // -- Domain-Felder (transient, nicht in DB) --

    @Transient private Spielregeln spielregeln;
    @Transient private Kartendeck kartendeck;
    @Transient private TrumpfOrdnung trumpfOrdnung;
    @Transient private Spieltyp spieltyp;
    @Transient private SpielerPosition geber;
    @Transient private Spielphase phase;
    @Transient private Map<SpielerPosition, Hand> haende;
    @Transient private List<VorbehaltMeldung> vorbehalte;
    @Transient private Parteien parteien;
    @Transient private Ansagen ansagen;
    @Transient private List<Stich> abgeschlosseneStiche;
    @Transient private Spielergebnis ergebnis;
    /** Position des Solisten aus dem vorherigen Spiel; bestimmt den ersten Aufspieler. */
    @Transient private SpielerPosition solistAufspieler;
    /** Spieler die in diesem Spiel bereits geschmissen haben — dürfen kein zweites Mal schmeißen. */
    @Transient private Set<SpielerPosition> bereitsGeschmissen = EnumSet.noneOf(SpielerPosition.class);
    @Transient private int spielNummer;
    @Transient private Partie partieRef;

    // ── DB-Spalten (aus SpielEntity uebernommen) ────────────────────────
    @Column("geber_position") private String geberPosition;
    @Column("spieltyp") private String spieltypText;
    @Column("phase") private String phaseText;
    @Column("vorbehalte") private String vorbehalteJson;
    @Column("ansagen") private String ansagenJson;
    @Column("armut_spieler_position") private String armutSpielerPosition;
    @Column("armut_aktueller_antwort_index") private int armutAktuellerAntwortIndex;
    @Column("armut_angebot_abgegeben") private boolean armutAngebotAbgegeben;
    @Column("armut_partner_spieler_position") private String armutPartnerSpielerPosition;
    @Column("armut_angebotene_karten") private String armutAngeboteneKartenJson;
    @Column("hochzeit_spieler_position") private String hochzeitSpielerPositionText;
    @Column("hochzeit_geklaerte_stiche") private int hochzeitGeklaerteStiche;
    @Column("hochzeit_partner_spieler_position") private String hochzeitPartnerSpielerPositionText;
    @Column("hochzeit_stilles_solo") private boolean hochzeitStillesSolo;
    @Column("pflicht_ansage_ausstehend") private String pflichtAnsageAusstehendJson = "[]";
    @Column("schweinchen_aktiv") private boolean schweinchenAktivFlag;
    @Column("bereits_geschmissen_json") private String bereitsGeschmisenJson = "[]";
    @Column("aktueller_stich_aufspieler_position") private String aktuellerStichAufspielerPositionText;
    @Column("aktueller_stich_karten") private String aktuellerStichKartenJson;
    @Column("re_augen") private Integer reAugen;
    @Column("kontra_augen") private Integer kontraAugen;
    @Column("sieger_partei") private String siegerParteiText;
    @Column("spielwert") private Integer spielwertPunkte;
    @Column("grundwert") private Integer grundwertDb;
    @Column("absage_punkte") private Integer absagePunkteDb;
    @Column("gegen_die_alten_punkte") private Integer gegenDieAltenPunkteDb;
    @Column("solo_multiplikator") private Integer soloMultiplikatorDb;
    @Column("spielpunkte_sued") private Integer spielpunkteSued;
    @Column("spielpunkte_west") private Integer spielpunkteWest;
    @Column("spielpunkte_nord") private Integer spielpunkteNord;
    @Column("spielpunkte_ost") private Integer spielpunkteOst;
    @Column("haende_json") private String haendeJson;
    @Column("stiche_json") private String sticheJson;
    @MappedCollection(idColumn = "spiel_id", keyColumn = "spiel_key")
    private List<SpielSonderpunktEntity> sonderpunktEntities = new ArrayList<>();

    // -- Konstruktoren --

    /** No-arg-Konstruktor fuer Spring Data JDBC. */
    protected Spiel() {
        super();
    }

    private Spiel(
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
        return new SpielBuilder().spielregeln(spielregeln).kartendeck(kartendeck)
            .trumpfOrdnung(trumpfOrdnungFuerPersistiertenStand(spielregeln, spieltyp, schweinchenAktiv))
            .spieltyp(spieltyp).geber(geber).phase(phase).haende(haende).vorbehalte(vorbehalte)
            .parteien(parteien).ansagen(ansagen).abgeschlosseneStiche(abgeschlosseneStiche)
            .ergebnis(ergebnis).solistAufspieler(solistAufspieler).build();
    }

    /** Erstellt eine minimale Persistenz-Entity ohne Domain-Felder. */
    public static Spiel neuePersistenz(int spielNummer, SpielerPosition geberPosition, Spieltyp spieltyp, Spielphase phase) {
        Spiel spiel = new Spiel();
        spiel.spielNummer = spielNummer;
        spiel.geberPosition = geberPosition.name();
        spiel.spieltypText = spieltyp.name();
        spiel.phaseText = phase.name();
        return spiel;
    }

    public static Map<SpielerPosition, Integer> gewonneneStiche(Spiel spiel) {
        EnumMap<SpielerPosition, Integer> map = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) { map.put(pos, 0); }
        spiel.sticheAlsJson().forEach(s -> map.merge(s.gewinnerPosition(), 1, Integer::sum));
        return Map.copyOf(map);
    }

    // -- Domain-Aktionen --

    public Spiel teileKartenAus() {
        pruefePhase(Spielphase.KartenAusteilen.class, "Karten austeilen");
        Map<SpielerPosition, Hand> neueHaende = haendeAusDeck(kartendeck);
        TrumpfOrdnung neueTrumpfOrdnung = hatSchweinchen(spielregeln, neueHaende) ? new SchweinchenTrumpfOrdnung(spielregeln) : trumpfOrdnung;
        return toBuilder().trumpfOrdnung(neueTrumpfOrdnung).phase(Spielphase.VORBEHALT_ANSAGE)
            .haende(neueHaende).vorbehalte(List.of()).parteien(null).ergebnis(null).build();
    }

    public Optional<SpielerPosition> naechsterVorbehaltSpieler() {
        if (!(phase instanceof Spielphase.VorbehaltAnsage) || vorbehalte.size() >= SpielerPosition.standardReihenfolge().size()) { return Optional.empty(); }
        return Optional.of(SpielerPosition.imUhrzeigersinnAb(geber.naechsteImUhrzeigersinn()).get(vorbehalte.size()));
    }

    public Spiel meldeGesund(SpielerPosition spielerPosition) { return meldeVorbehalt(spielerPosition, VorbehaltAnsage.GESUND); }

    public Spiel meldeVorbehalt(SpielerPosition spielerPosition, VorbehaltAnsage vorbehaltAnsage) {
        pruefePhase(Spielphase.VorbehaltAnsage.class, "Gesund melden");
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(vorbehaltAnsage, "vorbehaltAnsage darf nicht null sein");
        SpielerPosition erwarteterSpieler = naechsterVorbehaltSpieler().orElseThrow(() -> new IllegalStateException("Es werden keine Vorbehalte mehr erwartet"));
        if (spielerPosition != erwarteterSpieler) { throw new IllegalStateException("Vorbehalte muessen in Sitzreihenfolge gemeldet werden; erwartet: " + erwarteterSpieler); }
        if (vorbehaltAnsage == VorbehaltAnsage.SCHMEISSEN && bereitsGeschmissen.contains(spielerPosition)) { throw new IllegalStateException("Spieler " + spielerPosition + " hat das Schmeiss-Recht in diesem Spiel bereits genutzt"); }
        if (!vorbehaltAnsage.istZulaessig(handVon(spielerPosition), spielregeln)) { throw new IllegalStateException("Vorbehalt " + vorbehaltAnsage + " ist fuer " + spielerPosition + " nach den Spielregeln nicht zulaessig"); }
        List<VorbehaltMeldung> neueVorbehalte = new ArrayList<>(vorbehalte);
        neueVorbehalte.add(new VorbehaltMeldung(spielerPosition, vorbehaltAnsage));
        Spielphase naechstePhase = neueVorbehalte.size() == SpielerPosition.standardReihenfolge().size() ? Spielphase.VORBEHALT_AUFLOESUNG : Spielphase.VORBEHALT_ANSAGE;
        Set<SpielerPosition> neueBereitsGeschmissen = vorbehaltAnsage == VorbehaltAnsage.SCHMEISSEN ? addToSet(bereitsGeschmissen, spielerPosition) : bereitsGeschmissen;
        return toBuilder().bereitsGeschmissen(neueBereitsGeschmissen).phase(naechstePhase).vorbehalte(neueVorbehalte).build();
    }

    public Spiel loeseVorbehalteAuf() {
        pruefePhase(Spielphase.VorbehaltAufloesung.class, "Vorbehalte aufloesen");
        VorbehaltMeldung hoechsterVorbehalt = hoechsterVorbehalt().orElse(null);
        if (hoechsterVorbehalt != null && hoechsterVorbehalt.ansage() == VorbehaltAnsage.SCHMEISSEN) {
            return eingeworfenesSpiel();
        }
        SpielerPosition ersterAufspieler = solistAufspieler != null ? solistAufspieler : geber.naechsteImUhrzeigersinn();
        if (hoechsterVorbehalt == null) {
            SpielerPosition stillesSoloSpieler = erkenneStillesSoloSpieler();
            if (stillesSoloSpieler != null) {
                return toBuilder().trumpfOrdnung(hatSchweinchen(spielregeln, haende) ? new SchweinchenTrumpfOrdnung(spielregeln) : new NormaleTrumpfOrdnung(spielregeln))
                    .spieltyp(Spieltyp.SOLO_TRUMPF).phase(new Spielphase.Stichphase(Stich.neu(ersterAufspieler), Set.of(), null))
                    .parteien(Parteien.ausSolo(stillesSoloSpieler)).ansagen(Ansagen.leer()).abgeschlosseneStiche(List.of()).ergebnis(null).solistAufspieler(null).build();
            }
        }
        Parteien neueParteien = hoechsterVorbehalt == null ? Parteien.ausNormalspielHaenden(haende) : parteienFuer(hoechsterVorbehalt);
        HochzeitStatus neuerHochzeitStatus = hoechsterVorbehalt != null && hoechsterVorbehalt.ansage() == VorbehaltAnsage.HOCHZEIT ? HochzeitStatus.gestartet(hoechsterVorbehalt.spielerPosition()) : null;
        ArmutStatus neuerArmutStatus = hoechsterVorbehalt != null && hoechsterVorbehalt.ansage() == VorbehaltAnsage.ARMUT ? ArmutStatus.gestartet(hoechsterVorbehalt.spielerPosition()) : null;
        Spielphase naechstePhase = neuerArmutStatus != null ? new Spielphase.ArmutTausch(neuerArmutStatus) : new Spielphase.Stichphase(Stich.neu(ersterAufspieler), Set.of(), neuerHochzeitStatus);
        return toBuilder().trumpfOrdnung(trumpfOrdnungFuer(hoechsterVorbehalt)).spieltyp(spieltypFuer(hoechsterVorbehalt)).phase(naechstePhase)
            .parteien(neueParteien).ansagen(Ansagen.leer()).abgeschlosseneStiche(List.of()).ergebnis(null).solistAufspieler(null).build();
    }

    public Spiel legeArmutTrumpfkarten(SpielerPosition spielerPosition, List<Karte> angeboteneTrumpfkarten) {
        if (!(phase instanceof Spielphase.ArmutTausch armutTauschPhase)) { throw new IllegalStateException("Armut-Karten anbieten ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + phase.name()); }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(angeboteneTrumpfkarten, "angeboteneTrumpfkarten duerfen nicht null sein");
        ArmutStatus status = armutTauschPhase.armutStatus();
        if (spielerPosition != status.armutSpieler()) { throw new IllegalStateException("Nur der Armut-Spieler darf Trumpfkarten anbieten"); }
        if (status.angebotLiegtVor()) { throw new IllegalStateException("Die Trumpfkarten fuer die Armut wurden bereits angeboten"); }
        Hand armutHand = handVon(spielerPosition);
        long anzahlTruepfe = anzahlTruepfe(armutHand);
        if (angeboteneTrumpfkarten.size() != anzahlTruepfe) { throw new IllegalStateException("Die Armut muss genau alle eigenen Trumpfkarten anbieten; erwartet: " + anzahlTruepfe); }
        for (Karte karte : angeboteneTrumpfkarten) {
            if (!armutHand.enthaelt(karte)) { throw new IllegalStateException("Angebotene Karte ist nicht auf der Hand des Armut-Spielers: " + karte); }
            if (!trumpfOrdnung.istTrumpf(karte)) { throw new IllegalStateException("In der Armut duerfen nur Trumpfkarten angeboten werden: " + karte); }
        }
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende();
        neueHaende.put(spielerPosition, armutHand.ohneAlle(angeboteneTrumpfkarten));
        return toBuilder().haende(neueHaende).phase(new Spielphase.ArmutTausch(status.mitAngebot(angeboteneTrumpfkarten))).build();
    }

    public Spiel lehneArmutAb(SpielerPosition spielerPosition) {
        if (!(phase instanceof Spielphase.ArmutTausch armutTauschPhase)) { throw new IllegalStateException("Armut ablehnen ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + phase.name()); }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        ArmutStatus status = armutTauschPhase.armutStatus();
        if (!status.angebotLiegtVor()) { throw new IllegalStateException("Die Armut kann erst nach dem Trumpf-Angebot abgelehnt werden"); }
        ArmutStatus neuerStatus = status.mitAblehnung(spielerPosition);
        if (neuerStatus.alleAntwortenErschoepft()) { return eingeworfenesSpiel(); }
        return toBuilder().phase(new Spielphase.ArmutTausch(neuerStatus)).build();
    }

    public Spiel nimmArmutAn(SpielerPosition spielerPosition, List<Karte> rueckgabekarten) {
        if (!(phase instanceof Spielphase.ArmutTausch armutTauschPhase)) { throw new IllegalStateException("Armut annehmen ist nur in Phase ARMUT_TAUSCH erlaubt, war aber " + phase.name()); }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(rueckgabekarten, "rueckgabekarten duerfen nicht null sein");
        ArmutStatus status = armutTauschPhase.armutStatus();
        if (!status.angebotLiegtVor()) { throw new IllegalStateException("Die Armut kann erst nach dem Trumpf-Angebot angenommen werden"); }
        SpielerPosition erwarteterSpieler = status.aktuellerAntwortspieler().orElseThrow(() -> new IllegalStateException("Es gibt aktuell keinen moeglichen Armut-Partner"));
        if (spielerPosition != erwarteterSpieler) { throw new IllegalStateException("Die Armut muss reihum beantwortet werden; erwartet: " + erwarteterSpieler); }
        if (rueckgabekarten.size() != status.angeboteneTrumpfkarten().size()) { throw new IllegalStateException("Es muessen genau " + status.angeboteneTrumpfkarten().size() + " Karten zurueckgegeben werden"); }
        Hand partnerHand = handVon(spielerPosition);
        for (Karte karte : rueckgabekarten) { if (!partnerHand.enthaelt(karte)) { throw new IllegalStateException("Zurueckgegebene Karte ist nicht auf der Hand des annehmenden Spielers: " + karte); } }
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende();
        neueHaende.put(spielerPosition, partnerHand.ohneAlle(rueckgabekarten).mitAllen(status.angeboteneTrumpfkarten()));
        neueHaende.put(status.armutSpieler(), handVon(status.armutSpieler()).mitAllen(rueckgabekarten));
        TrumpfOrdnung neueTrumpfOrdnung = hatSchweinchen(spielregeln, neueHaende) ? new SchweinchenTrumpfOrdnung(spielregeln) : new NormaleTrumpfOrdnung(spielregeln);
        Parteien neueParteien = parteien.mitPartei(spielerPosition, Partei.RE).mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge());
        SpielerPosition ersterAufspieler = solistAufspieler != null ? solistAufspieler : geber.naechsteImUhrzeigersinn();
        return toBuilder().trumpfOrdnung(neueTrumpfOrdnung).phase(new Spielphase.Stichphase(Stich.neu(ersterAufspieler), Set.of(), null))
            .haende(neueHaende).parteien(neueParteien).ansagen(Ansagen.leer()).abgeschlosseneStiche(List.of()).ergebnis(null).solistAufspieler(null).build();
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

    public SpielAktion spieleKarte(SpielerPosition spielerPosition, Karte karte) {
        if (!(phase instanceof Spielphase.Stichphase stichphase)) { throw new IllegalStateException("Karte spielen ist nur in Phase STICHPHASE erlaubt, war aber " + phase.name()); }
        Objects.requireNonNull(spielerPosition, "spielerPosition darf nicht null sein");
        Objects.requireNonNull(karte, "karte darf nicht null sein");
        if (!stichphase.pflichtansageAusstehend().isEmpty()) { throw new IllegalStateException("Karte spielen ist erst erlaubt wenn alle ausstehenden Pflichtansagen gemacht wurden: " + stichphase.pflichtansageAusstehend()); }
        Hand hand = handVon(spielerPosition);
        Stich gespielterStich = stichphase.aktuellerStich().spieleKarte(spielerPosition, karte, hand, trumpfOrdnung);
        Map<SpielerPosition, Hand> neueHaende = kopiereHaende();
        neueHaende.put(spielerPosition, hand.ohne(karte));
        List<SpielEreignis> ereignisse = new ArrayList<>();
        ereignisse.add(new SpielEreignis.KarteGespielt(spielerPosition, karte));
        if (!gespielterStich.istVollstaendig()) {
            return new SpielAktion(neuesSpielMitStichfortschritt(neueHaende, abgeschlosseneStiche, new Spielphase.Stichphase(gespielterStich, stichphase.pflichtansageAusstehend(), stichphase.hochzeitStatus()), parteien), List.copyOf(ereignisse));
        }
        List<Stich> neueAbgeschlosseneStiche = new ArrayList<>(abgeschlosseneStiche);
        neueAbgeschlosseneStiche.add(gespielterStich);
        HochzeitFortschritt hf = fortschrittNachVollstaendigemStich(gespielterStich, stichphase.hochzeitStatus());
        Set<Partei> neuesPflichtansageAusstehend = berechneNeuePflichtansagen(gespielterStich, neueAbgeschlosseneStiche.size(), hf.parteien());
        List<SonderpunktEreignis> sonderpunkte = new SonderpunktBewerter()
            .bewerte(List.of(gespielterStich), hf.parteien(), trumpfOrdnung, spielregeln)
            .values().stream().flatMap(List::stream).toList();
        ereignisse.add(new SpielEreignis.StichAbgeschlossenEreignis(gespielterStich, sonderpunkte));
        if (neueAbgeschlosseneStiche.size() == kartenProSpieler()) {
            return new SpielAktion(neuesSpielMitStichfortschritt(neueHaende, neueAbgeschlosseneStiche, Spielphase.AUSWERTUNG, hf.parteien()), List.copyOf(ereignisse));
        }
        Stich naechsterStich = Stich.neu(gespielterStich.naechsterAufspieler(trumpfOrdnung));
        return new SpielAktion(neuesSpielMitStichfortschritt(neueHaende, neueAbgeschlosseneStiche, new Spielphase.Stichphase(naechsterStich, neuesPflichtansageAusstehend, hf.status()), hf.parteien()), List.copyOf(ereignisse));
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

    public Spiel sageAn(SpielerPosition spielerPosition, Ansage ansage) {
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
        return toBuilder().parteien(aktualisierteParteien).ansagen(neueAnsagen).phase(new Spielphase.Stichphase(stichphase.aktuellerStich(), aktualisiertesPflichtansageAusstehend, stichphase.hochzeitStatus())).solistAufspieler(null).build();
    }

    private int effektiveKartenAnzahlFuer(SpielerPosition pos, Ansage ansage, Set<Partei> pflichtansageAusstehend) {
        Partei partei = parteien().parteiVon(pos);
        return (!pflichtansageAusstehend.isEmpty() && pflichtansageAusstehend.contains(partei) && ansage.istGrundansage()) ? Integer.MAX_VALUE : handVon(pos).karten().size();
    }

    public Spiel werteAus() {
        pruefePhase(Spielphase.Auswertung.class, "Spiel auswerten");
        Spielergebnis neuesErgebnis = new PunkteRechner().berechneNormalspielErgebnis(abgeschlosseneStiche, parteien(), trumpfOrdnung, ansagen, spielregeln);
        return toBuilder().phase(Spielphase.GESAMTSTAND_AKTUALISIEREN).ergebnis(neuesErgebnis).solistAufspieler(null).build();
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

    private static boolean istKaroAs(Karte k) { return k.farbe() == Farbe.KARO && k.wert() == Kartenwert.AS; }

    public boolean hatHerzDurchgegangenenStich() { return abgeschlosseneStiche.stream().anyMatch(this::istHerzDurchgegangen); }

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
    public List<SpielSonderpunktEntity> sonderpunktEntities() { sonderpunktEntities.forEach(sp -> sp.setzeSpiel(this)); return List.copyOf(sonderpunktEntities); }
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
        this.reAugen = erg.reAugen();
        this.kontraAugen = erg.kontraAugen();
        this.siegerParteiText = erg.siegerPartei() != null ? erg.siegerPartei().name() : null;
        this.spielwertPunkte = erg.spielwert();
        this.spielpunkteSued = erg.spielpunkteSued();
        this.spielpunkteWest = erg.spielpunkteWest();
        this.spielpunkteNord = erg.spielpunkteNord();
        this.spielpunkteOst = erg.spielpunkteOst();
        sonderpunktEntities.clear();
        for (Map.Entry<Partei, List<SonderpunktEreignis>> eintrag : spielergebnis.sonderpunkteProPartei().entrySet()) {
            for (SonderpunktEreignis ereignis : eintrag.getValue()) {
                SpielSonderpunktEntity sonderpunktEntity = SpielSonderpunktEntity.neu(eintrag.getKey(), ereignis);
                sonderpunktEntity.setzeSpiel(this);
                sonderpunktEntities.add(sonderpunktEntity);
            }
        }
    }

    public void ersetzeAnsagen(List<AnsageEreignisEmbeddable> neueAnsagen) {
        Objects.requireNonNull(neueAnsagen, "neueAnsagen duerfen nicht null sein");
        this.ansagenJson = JsonKonverter.schreibeAlsJson(neueAnsagen);
    }

    public void setzeAktuellenStich(SpielerPosition aufspielerPosition, List<AktuellerStichKarteEmbeddable> neueKarten) {
        this.aktuellerStichAufspielerPositionText = aufspielerPosition != null ? aufspielerPosition.name() : null;
        this.aktuellerStichKartenJson = JsonKonverter.schreibeAlsJson(
            Objects.requireNonNull(neueKarten, "neueKarten duerfen nicht null sein")
        );
    }

    public void setzeHochzeitStatus(SpielerPosition spielerPosition, int geklaerteStiche, SpielerPosition partnerPosition, boolean stillesSolo) {
        this.hochzeitSpielerPositionText = spielerPosition != null ? spielerPosition.name() : null;
        this.hochzeitGeklaerteStiche = geklaerteStiche;
        this.hochzeitPartnerSpielerPositionText = partnerPosition != null ? partnerPosition.name() : null;
        this.hochzeitStillesSolo = stillesSolo;
    }

    // -- Hydrierung: DB-Felder -> Domain-Felder --

    public void hydriere(Spielregeln spielregeln) {
        hydriere(spielregeln, null);
    }

    public void hydriere(Spielregeln spielregeln, SpielerPosition solistDesLetztenSpiels) {
        Objects.requireNonNull(spielregeln, "spielregeln darf nicht null sein");
        this.spielregeln = spielregeln;
        this.solistAufspieler = solistDesLetztenSpiels;
        EnumMap<SpielerPosition, Hand> gh = new EnumMap<>(SpielerPosition.class);
        for (HandJsonEintrag e : haendeAlsJson()) { gh.put(e.spielerPosition(), new Hand(e.karten().stream().map(Spiel::alsKarte).toList())); }
        this.haende = Map.copyOf(gh);
        this.vorbehalte = vorbehalteAlsEmbeddable().stream().map(e -> new VorbehaltMeldung(e.spielerPosition(), e.ansage())).toList();
        this.ansagen = Ansagen.ausEreignissen(ansagenAlsEmbeddable().stream().map(e -> new AnsageEreignis(e.spielerPosition(), e.ansage())).toList());
        this.abgeschlosseneStiche = sticheAlsJson().stream().map(Spiel::alsStich).toList();
        this.spieltyp = Spieltyp.valueOf(spieltypText);
        this.geber = SpielerPosition.valueOf(geberPosition);
        List<Karte> alleKarten = new ArrayList<>();
        haendeAlsJson().forEach(h -> h.karten().forEach(k -> alleKarten.add(alsKarte(k))));
        sticheAlsJson().forEach(s -> s.gespielteKarten().forEach(k -> alleKarten.add(alsKarte(k))));
        aktuellerStichKarten().forEach(k -> alleKarten.add(alsKarte(k)));
        if ("ARMUT_TAUSCH".equals(phaseText) && armutPartnerSpielerPosition == null) { armutAngeboteneKartenDb().forEach(k -> alleKarten.add(alsKarte(k))); }
        this.kartendeck = Kartendeck.ausKarten(alleKarten);
        this.trumpfOrdnung = trumpfOrdnungFuerPersistiertenStand(spielregeln, this.spieltyp, schweinchenAktivFlag);
        this.phase = hydrierePhase();
        this.parteien = hydriereParteien().orElse(null);
        this.ergebnis = hydriereErgebnis().orElse(null);
        this.bereitsGeschmissen = hydriereBereitsGeschmissen();
    }

    private Spielphase hydrierePhase() {
        return switch (phaseText) {
            case "KARTEN_AUSTEILEN" -> Spielphase.KARTEN_AUSTEILEN;
            case "VORBEHALT_ANSAGE" -> Spielphase.VORBEHALT_ANSAGE;
            case "VORBEHALT_AUFLOESUNG" -> Spielphase.VORBEHALT_AUFLOESUNG;
            case "ARMUT_TAUSCH" -> new Spielphase.ArmutTausch(hydriereArmutStatus().orElseThrow(() -> new IllegalStateException("ARMUT_TAUSCH ohne ArmutStatus")));
            case "STICHPHASE" -> new Spielphase.Stichphase(hydriereAktuellenStich(), hydrierePflichtansageAusstehend(), hydriereHochzeitStatus().orElse(null));
            case "AUSWERTUNG" -> Spielphase.AUSWERTUNG;
            case "GESAMTSTAND_AKTUALISIEREN" -> Spielphase.GESAMTSTAND_AKTUALISIEREN;
            default -> throw new IllegalStateException("Unbekannte Phase: " + phaseText);
        };
    }

    private Optional<Parteien> hydriereParteien() {
        if (!istAufgeloest(phaseText)) { return Optional.empty(); }
        VorbehaltMeldung hoechster = hoechsterVorbehaltAusListe(vorbehalte).orElse(null);
        Parteien basis;
        if (hoechster == null) {
            basis = spieltyp == Spieltyp.SOLO_TRUMPF && erkenneStillesSoloSpielerAusPersistenz() != null ? Parteien.ausSolo(erkenneStillesSoloSpielerAusPersistenz()) : parteienFuerNormalspiel();
        } else {
            Optional<Parteien> sp = switch (hoechster.ansage()) {
                case SOLO_DAME, SOLO_BUBE, SOLO_TRUMPF, SOLO_TRUMPF_HERZ, SOLO_TRUMPF_PIK, SOLO_TRUMPF_KREUZ, SOLO_FLEISCHLOS -> Optional.of(Parteien.ausSolo(hoechster.spielerPosition()));
                case HOCHZEIT -> Optional.of(hydriereParteienFuerHochzeit(hoechster.spielerPosition()));
                case ARMUT -> Optional.of(hydriereParteienFuerArmut(hoechster.spielerPosition()));
                case GESUND, SCHMEISSEN -> Optional.empty();
            };
            if (sp.isEmpty()) { return Optional.empty(); }
            basis = sp.get();
        }
        List<SpielerPosition> offenbart = ansagen.ereignisse().stream().filter(e -> e.ansage().istGrundansage()).map(AnsageEreignis::spieler).toList();
        if (!offenbart.isEmpty()) { basis = basis.mitOffenenParteienFuerAlle(offenbart); }
        return Optional.of(basis);
    }

    private Parteien hydriereParteienFuerHochzeit(SpielerPosition hs) {
        if (hochzeitPartnerSpielerPositionDb() != null) { return Parteien.ausHochzeit(hs).mitPartei(hochzeitPartnerSpielerPositionDb(), Partei.RE).mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge()); }
        return hochzeitStillesSolo ? Parteien.ausSolo(hs) : Parteien.ausHochzeit(hs);
    }

    private Parteien hydriereParteienFuerArmut(SpielerPosition as) {
        Parteien p = Parteien.ausArmut(as);
        return armutPartnerSpielerPositionDb() == null ? p : p.mitPartei(armutPartnerSpielerPositionDb(), Partei.RE).mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge());
    }

    private Parteien parteienFuerNormalspiel() {
        EnumSet<SpielerPosition> re = EnumSet.noneOf(SpielerPosition.class);
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) { if (hatKreuzDameAusPersistenz(pos)) { re.add(pos); } }
        if (re.size() != 2) { throw new IllegalStateException("Ein Normalspiel braucht genau zwei Re-Spieler, gefunden: " + re.size()); }
        EnumMap<SpielerPosition, Partei> pm = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) { pm.put(pos, re.contains(pos) ? Partei.RE : Partei.KONTRA); }
        return Parteien.ausParteiMap(pm);
    }

    private boolean hatKreuzDameAusPersistenz(SpielerPosition pos) {
        Hand h = haende.get(pos);
        if (h != null && h.karten().stream().anyMatch(Spiel::istKreuzDame)) { return true; }
        if (sticheAlsJson().stream().flatMap(s -> s.gespielteKarten().stream()).filter(k -> k.spielerPosition() == pos).map(Spiel::alsKarte).anyMatch(Spiel::istKreuzDame)) { return true; }
        return aktuellerStichKarten().stream().filter(k -> k.spielerPosition() == pos).map(Spiel::alsKarte).anyMatch(Spiel::istKreuzDame);
    }

    private SpielerPosition erkenneStillesSoloSpielerAusPersistenz() {
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) {
            Hand h = haende.get(pos);
            long a = h == null ? 0 : h.karten().stream().filter(Spiel::istKreuzDame).count();
            long b = sticheAlsJson().stream().flatMap(s -> s.gespielteKarten().stream()).filter(k -> k.spielerPosition() == pos).map(Spiel::alsKarte).filter(Spiel::istKreuzDame).count();
            long c = aktuellerStichKarten().stream().filter(k -> k.spielerPosition() == pos).map(Spiel::alsKarte).filter(Spiel::istKreuzDame).count();
            if (a + b + c >= 2) { return pos; }
        }
        return null;
    }

    private Optional<HochzeitStatus> hydriereHochzeitStatus() {
        if (hochzeitSpielerPositionDb() != null) { return Optional.of(new HochzeitStatus(hochzeitSpielerPositionDb(), hochzeitGeklaerteStiche, hochzeitPartnerSpielerPositionDb(), hochzeitStillesSolo)); }
        if (!istAufgeloest(phaseText)) { return Optional.empty(); }
        return hoechsterVorbehaltAusListe(vorbehalte).filter(m -> m.ansage() == VorbehaltAnsage.HOCHZEIT).map(m -> HochzeitStatus.gestartet(m.spielerPosition()));
    }

    private Optional<ArmutStatus> hydriereArmutStatus() {
        if (armutSpielerPositionDb() == null && !istAufgeloest(phaseText)) { return Optional.empty(); }
        SpielerPosition as = armutSpielerPositionDb();
        if (as == null) { as = hoechsterVorbehaltAusListe(vorbehalte).filter(m -> m.ansage() == VorbehaltAnsage.ARMUT).map(VorbehaltMeldung::spielerPosition).orElse(null); }
        if (as == null) { return Optional.empty(); }
        SpielerPosition fas = as;
        List<SpielerPosition> reihenfolge = SpielerPosition.imUhrzeigersinnAb(fas.naechsteImUhrzeigersinn()).stream().filter(p -> p != fas).toList();
        return Optional.of(new ArmutStatus(fas, reihenfolge, armutAktuellerAntwortIndex, armutAngeboteneKartenDb().stream().map(Spiel::alsKarte).toList(), armutAngebotAbgegeben, armutPartnerSpielerPositionDb()));
    }

    private Stich hydriereAktuellenStich() {
        if (aktuellerStichAufspielerPosition() != null) { return Stich.ausPersistiertemStand(aktuellerStichAufspielerPosition(), aktuellerStichKarten().stream().map(Spiel::alsGespielteKarte).toList()); }
        return Stich.neu(sticheAlsJson().isEmpty() ? SpielerPosition.valueOf(geberPosition).naechsteImUhrzeigersinn() : sticheAlsJson().getLast().gewinnerPosition());
    }

    private Set<Partei> hydrierePflichtansageAusstehend() {
        List<String> n = pflichtansageAusstehendDb();
        if (n.isEmpty()) { return Set.of(); }
        EnumSet<Partei> r = EnumSet.noneOf(Partei.class);
        n.forEach(name -> r.add(Partei.valueOf(name)));
        return Set.copyOf(r);
    }

    private Set<SpielerPosition> hydriereBereitsGeschmissen() {
        List<String> n = JsonKonverter.liesList(bereitsGeschmisenJson != null ? bereitsGeschmisenJson : "[]", new TypeReference<>() {});
        if (n.isEmpty()) { return Set.of(); }
        EnumSet<SpielerPosition> r = EnumSet.noneOf(SpielerPosition.class);
        n.forEach(name -> r.add(SpielerPosition.valueOf(name)));
        return Set.copyOf(r);
    }

    private Optional<Spielergebnis> hydriereErgebnis() {
        SpielErgebnisEmbeddable e = ergebnisEmbeddable();
        if (e == null) { return Optional.empty(); }
        EnumMap<Partei, Augen> ap = new EnumMap<>(Partei.class);
        ap.put(Partei.RE, new Augen(e.reAugen())); ap.put(Partei.KONTRA, new Augen(e.kontraAugen()));
        EnumMap<SpielerPosition, Spielpunkte> sp = new EnumMap<>(SpielerPosition.class);
        sp.put(SpielerPosition.SUED, new Spielpunkte(e.spielpunkteSued())); sp.put(SpielerPosition.WEST, new Spielpunkte(e.spielpunkteWest()));
        sp.put(SpielerPosition.NORD, new Spielpunkte(e.spielpunkteNord())); sp.put(SpielerPosition.OST, new Spielpunkte(e.spielpunkteOst()));
        EnumMap<Partei, List<SonderpunktEreignis>> spp = new EnumMap<>(Partei.class);
        spp.put(Partei.RE, sonderpunktEntities.stream().filter(x -> x.partei() == Partei.RE).map(SpielSonderpunktEntity::alsEreignis).toList());
        spp.put(Partei.KONTRA, sonderpunktEntities.stream().filter(x -> x.partei() == Partei.KONTRA).map(SpielSonderpunktEntity::alsEreignis).toList());
        Integer gw = e.grundwert(); Integer abp = e.absagePunkte(); Integer gdap = e.gegenDieAltenPunkte(); Integer sm = e.soloMultiplikator();
        return Optional.of(new Spielergebnis(ap, e.siegerPartei(), new Spielpunkte(e.spielwert()),
            gw != null ? gw : e.spielwert(), abp != null ? abp : 0, gdap != null ? gdap : 0, sm != null ? sm : 1, sp, spp));
    }

    // -- Sync: Domain-Felder -> DB-Felder --

    public void syncZuPersistenz() {
        if (spielregeln == null) return;
        geberPosition = geber.name(); spieltypText = spieltyp.name(); phaseText = phase.name();
        vorbehalteJson = JsonKonverter.schreibeAlsJson(vorbehalte.stream().map(m -> VorbehaltMeldungEmbeddable.neu(m.spielerPosition(), m.ansage())).toList());
        ansagenJson = JsonKonverter.schreibeAlsJson(ansagen.ereignisse().stream().map(e -> AnsageEreignisEmbeddable.neu(e.spieler(), e.ansage())).toList());
        if (ergebnis != null) { syncErgebnis(ergebnis); } else { leereErgebnis(); }
        haendeJson = JsonKonverter.schreibeAlsJson(SpielerPosition.standardReihenfolge().stream().filter(haende::containsKey).map(p -> HandJsonEintrag.aus(p, haende.get(p).karten())).toList());
        sticheJson = JsonKonverter.schreibeAlsJson(alsStichJsonEintraege());
        aktuellerStich().ifPresentOrElse(s -> { aktuellerStichAufspielerPositionText = s.aufspieler().name(); aktuellerStichKartenJson = JsonKonverter.schreibeAlsJson(s.gespielteKarten().stream().map(AktuellerStichKarteEmbeddable::aus).toList()); },
            () -> { aktuellerStichAufspielerPositionText = null; aktuellerStichKartenJson = "[]"; });
        armutStatus().ifPresentOrElse(st -> { armutSpielerPosition = st.armutSpieler().name(); armutAktuellerAntwortIndex = st.aktuellerIndex(); armutAngebotAbgegeben = st.angebotLiegtVor();
            armutPartnerSpielerPosition = st.partner().map(SpielerPosition::name).orElse(null); armutAngeboteneKartenJson = JsonKonverter.schreibeAlsJson(st.partner().isPresent() ? List.of() : st.angeboteneTrumpfkarten().stream().map(HandKarteEmbeddable::aus).toList()); },
            () -> { armutSpielerPosition = null; armutAktuellerAntwortIndex = 0; armutAngebotAbgegeben = false; armutPartnerSpielerPosition = null; armutAngeboteneKartenJson = "[]"; });
        hochzeitStatus().ifPresentOrElse(st -> { hochzeitSpielerPositionText = st.hochzeitSpieler().name(); hochzeitGeklaerteStiche = st.geklaerteStiche(); hochzeitPartnerSpielerPositionText = st.partner().map(SpielerPosition::name).orElse(null); hochzeitStillesSolo = st.stillesSolo(); },
            () -> { hochzeitSpielerPositionText = null; hochzeitGeklaerteStiche = 0; hochzeitPartnerSpielerPositionText = null; hochzeitStillesSolo = false; });
        pflichtAnsageAusstehendJson = JsonKonverter.schreibeAlsJson(pflichtansageAusstehend().stream().map(Enum::name).toList());
        schweinchenAktivFlag = schweinchenAktiv();
        bereitsGeschmisenJson = JsonKonverter.schreibeAlsJson(bereitsGeschmissen.stream().map(Enum::name).toList());
    }

    private void syncErgebnis(Spielergebnis se) {
        SpielErgebnisEmbeddable e = SpielErgebnisEmbeddable.aus(se);
        reAugen = e.reAugen(); kontraAugen = e.kontraAugen(); siegerParteiText = e.siegerPartei() != null ? e.siegerPartei().name() : null;
        spielwertPunkte = e.spielwert(); grundwertDb = e.grundwert(); absagePunkteDb = e.absagePunkte();
        gegenDieAltenPunkteDb = e.gegenDieAltenPunkte(); soloMultiplikatorDb = e.soloMultiplikator();
        spielpunkteSued = e.spielpunkteSued(); spielpunkteWest = e.spielpunkteWest(); spielpunkteNord = e.spielpunkteNord(); spielpunkteOst = e.spielpunkteOst();
        sonderpunktEntities.clear();
        for (var eintrag : se.sonderpunkteProPartei().entrySet()) { for (SonderpunktEreignis er : eintrag.getValue()) { SpielSonderpunktEntity spe = SpielSonderpunktEntity.neu(eintrag.getKey(), er); spe.setzeSpiel(this); sonderpunktEntities.add(spe); } }
    }

    private void leereErgebnis() {
        reAugen = null; kontraAugen = null; siegerParteiText = null; spielwertPunkte = null;
        grundwertDb = null; absagePunkteDb = null; gegenDieAltenPunkteDb = null; soloMultiplikatorDb = null;
        spielpunkteSued = null; spielpunkteWest = null; spielpunkteNord = null; spielpunkteOst = null;
        sonderpunktEntities.clear();
    }

    private List<StichJsonEintrag> alsStichJsonEintraege() {
        List<StichJsonEintrag> res = new ArrayList<>();
        int idx = 1;
        for (Stich s : abgeschlosseneStiche) { res.add(new StichJsonEintrag(idx++, s.aufspieler(), s.gewinner(trumpfOrdnung).spieler(), s.augen().wert(), s.gespielteKarten().stream().map(AktuellerStichKarteEmbeddable::aus).toList())); }
        return List.copyOf(res);
    }

    // -- Domain-Stand-Uebernahme --

    public void uebernehmeDomainStand(Spiel quelle) {
        spielregeln = quelle.spielregeln; kartendeck = quelle.kartendeck; trumpfOrdnung = quelle.trumpfOrdnung;
        spieltyp = quelle.spieltyp; geber = quelle.geber; phase = quelle.phase; haende = quelle.haende;
        vorbehalte = quelle.vorbehalte; parteien = quelle.parteien; ansagen = quelle.ansagen;
        abgeschlosseneStiche = quelle.abgeschlosseneStiche; ergebnis = quelle.ergebnis; solistAufspieler = quelle.solistAufspieler;
        bereitsGeschmissen = quelle.bereitsGeschmissen;
        syncZuPersistenz();
    }

    // -- Private Hilfsmethoden --

    private boolean istHerzDurchgegangen(Stich s) { return s.istVollstaendig() && s.gespielteKarten().stream().allMatch(gk -> gk.karte().farbe() == Farbe.HERZ && !trumpfOrdnung.istTrumpf(gk.karte())); }

    private Set<SpielerPosition> addToSet(Set<SpielerPosition> set, SpielerPosition pos) {
        EnumSet<SpielerPosition> copy = set.isEmpty() ? EnumSet.noneOf(SpielerPosition.class) : EnumSet.copyOf(set);
        copy.add(pos);
        return Set.copyOf(copy);
    }

    private SpielBuilder toBuilder() {
        return new SpielBuilder().spielregeln(spielregeln).kartendeck(kartendeck).trumpfOrdnung(trumpfOrdnung)
            .spieltyp(spieltyp).geber(geber).phase(phase).haende(haende).vorbehalte(vorbehalte)
            .parteien(parteien).ansagen(ansagen).abgeschlosseneStiche(abgeschlosseneStiche)
            .ergebnis(ergebnis).solistAufspieler(solistAufspieler).bereitsGeschmissen(bereitsGeschmissen)
            .persistenceId(id()).persistenceErstelltAm(erstelltAm()).persistenceAktualisiertAm(aktualisiertAm()).persistenceIsNew(istNeu());
    }

    private Map<SpielerPosition, Hand> kopiereHaende() { EnumMap<SpielerPosition, Hand> k = new EnumMap<>(SpielerPosition.class); k.putAll(haende); return k; }
    private Optional<VorbehaltMeldung> hoechsterVorbehalt() { return hoechsterVorbehaltAusListe(vorbehalte); }

    private static Optional<VorbehaltMeldung> hoechsterVorbehaltAusListe(List<VorbehaltMeldung> vorbehalte) {
        VorbehaltMeldung best = null;
        for (VorbehaltMeldung m : vorbehalte) { if (!m.istVorbehalt()) continue; if (best == null || m.ansage().prioritaet() > best.ansage().prioritaet()) best = m; }
        return Optional.ofNullable(best);
    }

    private Spieltyp spieltypFuer(VorbehaltMeldung hv) { return hv == null ? Spieltyp.NORMALSPIEL : hv.ansage().spieltyp().orElseThrow(() -> new IllegalStateException("Vorbehalt ohne Spieltyp kann nicht aufgeloest werden")); }

    private TrumpfOrdnung trumpfOrdnungFuer(VorbehaltMeldung hv) {
        return hv == null ? trumpfOrdnung : switch (hv.ansage()) {
            case SOLO_DAME -> new DamensoloTrumpfOrdnung(); case SOLO_BUBE -> new BubensoloTrumpfOrdnung(); 
            case SOLO_TRUMPF -> new NormaleTrumpfOrdnung(spielregeln);
            case HOCHZEIT, ARMUT -> hatSchweinchen(spielregeln, haende) ? new SchweinchenTrumpfOrdnung(spielregeln) : new NormaleTrumpfOrdnung(spielregeln);
            case SOLO_TRUMPF_HERZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.HERZ, spielregeln); case SOLO_TRUMPF_PIK -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.PIK, spielregeln);
            case SOLO_TRUMPF_KREUZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.KREUZ, spielregeln); case SOLO_FLEISCHLOS -> new FleischlosTrumpfOrdnung();
            case GESUND, SCHMEISSEN -> throw new IllegalStateException("GESUND ist kein aufloesbarer Vorbehalt");
        };
    }

    private Parteien parteienFuer(VorbehaltMeldung hv) {
        return switch (hv.ansage()) {
            case SOLO_DAME, SOLO_BUBE, SOLO_TRUMPF, SOLO_TRUMPF_HERZ, SOLO_TRUMPF_PIK, SOLO_TRUMPF_KREUZ, SOLO_FLEISCHLOS -> Parteien.ausSolo(hv.spielerPosition());
            case HOCHZEIT -> Parteien.ausHochzeit(hv.spielerPosition()); case ARMUT -> Parteien.ausArmut(hv.spielerPosition());
            case GESUND, SCHMEISSEN -> throw new IllegalStateException("GESUND ist kein aufloesbarer Vorbehalt");
        };
    }

    public int kartenProSpieler() { return kartendeck.karten().size() / SpielerPosition.standardReihenfolge().size(); }
    private <T extends Spielphase> void pruefePhase(Class<T> erw, String aktion) { if (!erw.isInstance(phase)) throw new IllegalStateException(aktion + " ist nur in Phase " + erw.getSimpleName() + " erlaubt, war aber " + phase.name()); }

    public Spiel neuesSpielMitStichfortschritt(Map<SpielerPosition, Hand> nh, List<Stich> ns, Spielphase np, Parteien npa) {
        return toBuilder().phase(np).haende(nh).parteien(npa).abgeschlosseneStiche(ns).solistAufspieler(null).build();
    }

    private HochzeitFortschritt fortschrittNachVollstaendigemStich(Stich gs, HochzeitStatus ahs) {
        if (ahs == null || !ahs.suchtPartner()) { return new HochzeitFortschritt(parteien, ahs); }
        HochzeitStatus ns = ahs.mitGeklaertemStich(gs.gewinner(trumpfOrdnung).spieler());
        if (ns.partner().isPresent()) { return new HochzeitFortschritt(parteien.mitPartei(ns.partner().orElseThrow(), Partei.RE).mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge()), ns); }
        if (ns.stillesSolo()) { return new HochzeitFortschritt(Parteien.ausSolo(ns.hochzeitSpieler()), ns); }
        return new HochzeitFortschritt(parteien, ns);
    }

    private long anzahlTruepfe(Hand h) { return h.karten().stream().filter(trumpfOrdnung::istTrumpf).count(); }

    private Spiel eingeworfenesSpiel() {
        Kartendeck nd = kartendeck.gemischt();
        return toBuilder().kartendeck(nd).trumpfOrdnung(new NormaleTrumpfOrdnung(spielregeln)).spieltyp(Spieltyp.NORMALSPIEL)
            .phase(Spielphase.VORBEHALT_ANSAGE).haende(haendeAusDeck(nd)).vorbehalte(List.of()).parteien(null)
            .ansagen(Ansagen.leer()).abgeschlosseneStiche(List.of()).ergebnis(null).solistAufspieler(null).build();
    }

    private SpielerPosition erkenneStillesSoloSpieler() {
        for (SpielerPosition pos : SpielerPosition.standardReihenfolge()) { Hand h = haende.get(pos); if (h != null && h.karten().stream().filter(k -> k.farbe() == Farbe.KREUZ && k.wert() == Kartenwert.DAME).count() >= 2) return pos; }
        return null;
    }

    private static Map<SpielerPosition, Hand> haendeAusDeck(Kartendeck deck) {
        List<Hand> l = deck.anVierSpielerAusteilen(); List<SpielerPosition> p = SpielerPosition.standardReihenfolge();
        EnumMap<SpielerPosition, Hand> m = new EnumMap<>(SpielerPosition.class); for (int i = 0; i < p.size(); i++) m.put(p.get(i), l.get(i)); return Map.copyOf(m);
    }

    private static boolean hatSchweinchen(Spielregeln sr, Map<SpielerPosition, Hand> h) {
        return sr.schweinchenAktiv() && h.values().stream().anyMatch(hand -> hand.karten().stream().filter(k -> k.farbe() == Farbe.KARO && k.wert() == Kartenwert.AS).count() == 2);
    }

    private static boolean istKreuzDame(Karte k) { return k.farbe() == Farbe.KREUZ && k.wert() == Kartenwert.DAME; }
    private static boolean istAufgeloest(String pn) { return switch (pn) { case "ARMUT_TAUSCH", "STICHPHASE", "AUSWERTUNG", "GESAMTSTAND_AKTUALISIEREN" -> true; default -> false; }; }
    private static Karte alsKarte(HandKarteEmbeddable k) { return new Karte(k.farbe(), k.wert(), k.exemplarIndex()); }
    private static Karte alsKarte(AktuellerStichKarteEmbeddable k) { return new Karte(k.farbe(), k.wert(), k.exemplarIndex()); }
    private static GespielteKarte alsGespielteKarte(AktuellerStichKarteEmbeddable k) { return new GespielteKarte(k.spielerPosition(), alsKarte(k), k.reihenfolge()); }
    private static Stich alsStich(StichJsonEintrag e) { return Stich.ausPersistiertemStand(e.aufspielerPosition(), e.gespielteKarten().stream().map(Spiel::alsGespielteKarte).toList()); }

    private static TrumpfOrdnung trumpfOrdnungFuerPersistiertenStand(Spielregeln sr, Spieltyp st, boolean sa) {
        return switch (Objects.requireNonNull(st)) {
            case NORMALSPIEL, HOCHZEIT, ARMUT, SOLO_TRUMPF -> sa ? new SchweinchenTrumpfOrdnung(sr) : new NormaleTrumpfOrdnung(sr);
            case SOLO_TRUMPF_HERZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.HERZ, sr); case SOLO_TRUMPF_PIK -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.PIK, sr);
            case SOLO_TRUMPF_KREUZ -> new VariableTrumpfsoloTrumpfOrdnung(Farbe.KREUZ, sr); case SOLO_DAME -> new DamensoloTrumpfOrdnung();
            case SOLO_BUBE -> new BubensoloTrumpfOrdnung(); case SOLO_FLEISCHLOS -> new FleischlosTrumpfOrdnung();
        };
    }

    private record HochzeitFortschritt(Parteien parteien, HochzeitStatus status) {}

    // -- SpielBuilder --

    private static final class SpielBuilder {
        private Spielregeln spielregeln; private Kartendeck kartendeck; private TrumpfOrdnung trumpfOrdnung;
        private Spieltyp spieltyp; private SpielerPosition geber; private Spielphase phase;
        private Map<SpielerPosition, Hand> haende; private List<VorbehaltMeldung> vorbehalte;
        private Parteien parteien; private Ansagen ansagen; private List<Stich> abgeschlosseneStiche;
        private Spielergebnis ergebnis; private SpielerPosition solistAufspieler;
        private Set<SpielerPosition> bereitsGeschmissen;
        private UUID persistenceId; private Instant persistenceErstelltAm; private Instant persistenceAktualisiertAm; private boolean persistenceIsNew = true;

        SpielBuilder spielregeln(Spielregeln v) { this.spielregeln = v; return this; }
        SpielBuilder kartendeck(Kartendeck v) { this.kartendeck = v; return this; }
        SpielBuilder trumpfOrdnung(TrumpfOrdnung v) { this.trumpfOrdnung = v; return this; }
        SpielBuilder spieltyp(Spieltyp v) { this.spieltyp = v; return this; }
        SpielBuilder geber(SpielerPosition v) { this.geber = v; return this; }
        SpielBuilder phase(Spielphase v) { this.phase = v; return this; }
        SpielBuilder haende(Map<SpielerPosition, Hand> v) { this.haende = v; return this; }
        SpielBuilder vorbehalte(List<VorbehaltMeldung> v) { this.vorbehalte = v; return this; }
        SpielBuilder parteien(Parteien v) { this.parteien = v; return this; }
        SpielBuilder ansagen(Ansagen v) { this.ansagen = v; return this; }
        SpielBuilder abgeschlosseneStiche(List<Stich> v) { this.abgeschlosseneStiche = v; return this; }
        SpielBuilder ergebnis(Spielergebnis v) { this.ergebnis = v; return this; }
        SpielBuilder solistAufspieler(SpielerPosition v) { this.solistAufspieler = v; return this; }
        SpielBuilder bereitsGeschmissen(Set<SpielerPosition> v) { this.bereitsGeschmissen = v; return this; }
        SpielBuilder persistenceId(UUID v) { this.persistenceId = v; return this; }
        SpielBuilder persistenceErstelltAm(Instant v) { this.persistenceErstelltAm = v; return this; }
        SpielBuilder persistenceAktualisiertAm(Instant v) { this.persistenceAktualisiertAm = v; return this; }
        SpielBuilder persistenceIsNew(boolean v) { this.persistenceIsNew = v; return this; }

        Spiel build() {
            Spiel spiel = new Spiel(spielregeln, kartendeck, trumpfOrdnung, spieltyp, geber, phase,
                haende, vorbehalte, parteien, ansagen, abgeschlosseneStiche, ergebnis, solistAufspieler);
            if (bereitsGeschmissen != null) { spiel.bereitsGeschmissen = bereitsGeschmissen; }
            if (persistenceId != null) { spiel.setzeId(persistenceId); spiel.setzeErstelltAm(persistenceErstelltAm); spiel.setzeAktualisiertAm(persistenceAktualisiertAm); if (!persistenceIsNew) spiel.markiereAlsGeladen(); }
            spiel.syncZuPersistenz();
            return spiel;
        }
    }
}
