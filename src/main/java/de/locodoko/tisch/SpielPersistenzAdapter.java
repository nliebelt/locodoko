package de.locodoko.tisch;

import de.locodoko.karten.Augen;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.partie.GespielteKarte;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.partie.Stich;
import de.locodoko.partie.AnsageEreignis;
import de.locodoko.partie.Ansagen;
import de.locodoko.partie.ArmutStatus;
import de.locodoko.partie.HochzeitStatus;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.Spielpunkte;
import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.VorbehaltMeldung;
import de.locodoko.partie.AnsageEreignisEmbeddable;
import de.locodoko.partie.AktuellerStichKarteEmbeddable;
import de.locodoko.partie.HandJsonEintrag;
import de.locodoko.partie.HandKarteEmbeddable;
import de.locodoko.tisch.persistenz.SpielEntity;
import de.locodoko.partie.SpielErgebnisEmbeddable;
import de.locodoko.tisch.persistenz.SpielSonderpunktEntity;
import de.locodoko.partie.StichJsonEintrag;
import de.locodoko.partie.VorbehaltMeldungEmbeddable;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Adapter zwischen dem Domain-Spiel-Objekt und der JDBC-Persistenzschicht.
 *
 * <p>Konvertiert das unveraenderliche {@link de.locodoko.partie.Spiel}-Domain-Objekt
 * in persistierbare {@link de.locodoko.partie.SpielEntity}-Instanzen und umgekehrt.
 * Kapselt die Serialisierung von Haenden, Stichen, Ansagen, Vorbehaltmeldungen,
 * Hochzeit-/Armut-Status und Spielergebnis in die flache Embeddable-Struktur der
 * JDBC-Persistenz.</p>
 */
final class SpielPersistenzAdapter {

    private SpielPersistenzAdapter() {
    }

    static Spiel zuDomainSpiel(SpielEntity spielEntity, Spielregeln spielregeln) {
        Objects.requireNonNull(spielEntity, "spielEntity darf nicht null sein");
        Objects.requireNonNull(spielregeln, "spielregeln darf nicht null sein");
        Map<SpielerPosition, Hand> haende = haende(spielEntity);
        List<VorbehaltMeldung> vorbehalte = vorbehalte(spielEntity);
        Ansagen ansagen = ansagen(spielEntity);
        List<Stich> abgeschlosseneStiche = abgeschlosseneStiche(spielEntity);
        SpielerPosition solistAufspieler = spielEntity.partie().solistDesLetztenSpiels();
        Spielphase phase = bauePhase(spielEntity, vorbehalte);
        return Spiel.ausPersistiertemStand(
            spielregeln,
            Kartendeck.ausKarten(alleKarten(spielEntity)),
            spielEntity.spieltyp(),
            spielEntity.geberPosition(),
            phase,
            haende,
            vorbehalte,
            parteien(spielEntity, haende, vorbehalte, ansagen).orElse(null),
            ansagen,
            abgeschlosseneStiche,
            spielergebnis(spielEntity).orElse(null),
            spielEntity.schweinchenAktiv(),
            solistAufspieler
        );
    }

    private static Spielphase bauePhase(SpielEntity spielEntity, List<VorbehaltMeldung> vorbehalte) {
        return switch (spielEntity.phasenName()) {
            case "KARTEN_AUSTEILEN" -> Spielphase.KARTEN_AUSTEILEN;
            case "VORBEHALT_ANSAGE" -> Spielphase.VORBEHALT_ANSAGE;
            case "VORBEHALT_AUFLOESUNG" -> Spielphase.VORBEHALT_AUFLOESUNG;
            case "ARMUT_TAUSCH" -> new Spielphase.ArmutTausch(
                armutStatus(spielEntity, vorbehalte).orElseThrow(() ->
                    new IllegalStateException("ARMUT_TAUSCH ohne ArmutStatus"))
            );
            case "STICHPHASE" -> new Spielphase.Stichphase(
                aktuellerStich(spielEntity),
                pflichtansageAusstehend(spielEntity),
                hochzeitStatus(spielEntity, vorbehalte).orElse(null)
            );
            case "AUSWERTUNG" -> Spielphase.AUSWERTUNG;
            case "GESAMTSTAND_AKTUALISIEREN" -> Spielphase.GESAMTSTAND_AKTUALISIEREN;
            default -> throw new IllegalStateException("Unbekannte Phase: " + spielEntity.phasenName());
        };
    }

    static void uebernehmeDomainSpiel(SpielEntity ziel, Spiel quelle) {
        Objects.requireNonNull(ziel, "ziel darf nicht null sein");
        Objects.requireNonNull(quelle, "quelle darf nicht null sein");
        ziel.setzeSpieltyp(quelle.spieltyp());
        ziel.setzePhase(quelle.phase());
        ziel.ersetzeVorbehalte(quelle.vorbehalte().stream()
            .map(meldung -> VorbehaltMeldungEmbeddable.neu(meldung.spielerPosition(), meldung.ansage()))
            .toList());
        ziel.ersetzeAnsagen(quelle.ansagen().ereignisse().stream()
            .map(ereignis -> AnsageEreignisEmbeddable.neu(ereignis.spieler(), ereignis.ansage()))
            .toList());
        quelle.ergebnis().ifPresentOrElse(
            ziel::uebernehmeErgebnis,
            ziel::leereErgebnis
        );
        ziel.ersetzeHaende(SpielerPosition.standardReihenfolge().stream()
            .filter(position -> quelle.haende().containsKey(position))
            .map(position -> HandJsonEintrag.aus(position, quelle.handVon(position).karten()))
            .toList());
        ziel.ersetzeStiche(alsStichJsonEintraege(quelle));
        quelle.aktuellerStich().ifPresentOrElse(
            stich -> ziel.setzeAktuellenStich(
                stich.aufspieler(),
                stich.gespielteKarten().stream().map(AktuellerStichKarteEmbeddable::aus).toList()
            ),
            ziel::leereAktuellenStich
        );
        quelle.armutStatus().ifPresentOrElse(
            status -> ziel.setzeArmutStatus(
                status.armutSpieler(),
                status.aktuellerIndex(),
                status.angebotLiegtVor(),
                status.partner().orElse(null),
                status.partner().isPresent()
                    ? List.of()
                    : status.angeboteneTrumpfkarten().stream().map(HandKarteEmbeddable::aus).toList()
            ),
            ziel::leereArmutStatus
        );
        quelle.hochzeitStatus().ifPresentOrElse(
            status -> ziel.setzeHochzeitStatus(
                status.hochzeitSpieler(),
                status.geklaerteStiche(),
                status.partner().orElse(null),
                status.stillesSolo()
            ),
            ziel::leereHochzeitStatus
        );
        ziel.setzePflichtansageAusstehend(quelle.pflichtansageAusstehend());
        ziel.setzeSchweinchenAktiv(quelle.schweinchenAktiv());
    }

    static Map<SpielerPosition, Integer> gewonneneStiche(SpielEntity spielEntity) {
        EnumMap<SpielerPosition, Integer> gewonneneStiche = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            gewonneneStiche.put(position, 0);
        }
        spielEntity.stiche().forEach(stich -> gewonneneStiche.merge(stich.gewinnerPosition(), 1, Integer::sum));
        return Map.copyOf(gewonneneStiche);
    }

    private static Map<SpielerPosition, Hand> haende(SpielEntity spielEntity) {
        EnumMap<SpielerPosition, Hand> haende = new EnumMap<>(SpielerPosition.class);
        for (HandJsonEintrag hand : spielEntity.haende()) {
            haende.put(hand.spielerPosition(), new Hand(hand.karten().stream().map(SpielPersistenzAdapter::alsKarte).toList()));
        }
        return Map.copyOf(haende);
    }

    private static List<VorbehaltMeldung> vorbehalte(SpielEntity spielEntity) {
        return spielEntity.vorbehalte().stream()
            .map(eintrag -> new VorbehaltMeldung(eintrag.spielerPosition(), eintrag.ansage()))
            .toList();
    }

    private static Ansagen ansagen(SpielEntity spielEntity) {
        return Ansagen.ausEreignissen(spielEntity.ansagen().stream()
            .map(eintrag -> new AnsageEreignis(eintrag.spielerPosition(), eintrag.ansage()))
            .toList());
    }

    private static Optional<Parteien> parteien(
        SpielEntity spielEntity,
        Map<SpielerPosition, Hand> haende,
        List<VorbehaltMeldung> vorbehalte,
        Ansagen ansagen
    ) {
        if (!istAufgeloest(spielEntity.phasenName())) {
            return Optional.empty();
        }
        VorbehaltMeldung hoechsterVorbehalt = hoechsterVorbehalt(vorbehalte).orElse(null);
        Parteien basisParteien;
        if (hoechsterVorbehalt == null) {
            // Stilles Solo durch Gesund-Meldung: Spieltyp wurde in loeseVorbehalteAuf auf SOLO_TRUMPF gesetzt.
            // Der Solo-Spieler muss aus Haenden oder abgeschlossenen Stichen rekonstruiert werden.
            if (spielEntity.spieltyp() == Spieltyp.SOLO_TRUMPF) {
                SpielerPosition stillesSoloSpieler = erkenneStillesSoloSpieler(haende, spielEntity);
                if (stillesSoloSpieler != null) {
                    basisParteien = Parteien.ausSolo(stillesSoloSpieler);
                } else {
                    basisParteien = parteienFuerNormalspiel(spielEntity, haende);
                }
            } else {
                basisParteien = parteienFuerNormalspiel(spielEntity, haende);
            }
        } else {
            Optional<Parteien> parteienAusSonderspiel = switch (hoechsterVorbehalt.ansage()) {
                case SOLO_DAME, SOLO_BUBE, SOLO_TRUMPF,
                     SOLO_TRUMPF_HERZ, SOLO_TRUMPF_PIK, SOLO_TRUMPF_KREUZ,
                     SOLO_FLEISCHLOS ->
                    Optional.of(Parteien.ausSolo(hoechsterVorbehalt.spielerPosition()));
                case HOCHZEIT -> Optional.of(parteienFuerHochzeit(spielEntity, hoechsterVorbehalt.spielerPosition()));
                case ARMUT -> Optional.of(parteienFuerArmut(spielEntity, hoechsterVorbehalt.spielerPosition()));
                case GESUND -> Optional.empty();
            };
            if (parteienAusSonderspiel.isEmpty()) {
                return Optional.empty();
            }
            basisParteien = parteienAusSonderspiel.get();
        }
        // Grundansagen (Re/Kontra) offenbaren die Parteizugehoerigkeit — aus Ansagehistorie rekonstruieren,
        // damit nach einem DB-Roundtrip dieselbe offenFuerAlle-Menge vorliegt wie nach sageAn().
        List<SpielerPosition> durchGrundansageOffenbart = ansagen.ereignisse().stream()
            .filter(e -> e.ansage().istGrundansage())
            .map(AnsageEreignis::spieler)
            .toList();
        if (!durchGrundansageOffenbart.isEmpty()) {
            basisParteien = basisParteien.mitOffenenParteienFuerAlle(durchGrundansageOffenbart);
        }
        return Optional.of(basisParteien);
    }

    private static Parteien parteienFuerHochzeit(SpielEntity spielEntity, SpielerPosition hochzeitSpieler) {
        if (spielEntity.hochzeitPartnerSpielerPosition() != null) {
            return Parteien.ausHochzeit(hochzeitSpieler)
                .mitPartei(spielEntity.hochzeitPartnerSpielerPosition(), Partei.RE)
                .mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge());
        }
        if (spielEntity.hochzeitStillesSolo()) {
            return Parteien.ausSolo(hochzeitSpieler);
        }
        return Parteien.ausHochzeit(hochzeitSpieler);
    }

    private static Parteien parteienFuerArmut(SpielEntity spielEntity, SpielerPosition armutSpieler) {
        Parteien parteien = Parteien.ausArmut(armutSpieler);
        if (spielEntity.armutPartnerSpielerPosition() == null) {
            return parteien;
        }
        return parteien
            .mitPartei(spielEntity.armutPartnerSpielerPosition(), Partei.RE)
            .mitOffenenParteienFuerAlle(SpielerPosition.standardReihenfolge());
    }

    private static Parteien parteienFuerNormalspiel(SpielEntity spielEntity, Map<SpielerPosition, Hand> haende) {
        EnumSet<SpielerPosition> reSpieler = EnumSet.noneOf(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            if (hatKreuzDame(spielEntity, haende, position)) {
                reSpieler.add(position);
            }
        }
        if (reSpieler.size() != 2) {
            throw new IllegalStateException("Ein Normalspiel braucht genau zwei Re-Spieler, gefunden: " + reSpieler.size());
        }
        EnumMap<SpielerPosition, Partei> parteien = new EnumMap<>(SpielerPosition.class);
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            parteien.put(position, reSpieler.contains(position) ? Partei.RE : Partei.KONTRA);
        }
        return Parteien.ausParteiMap(parteien);
    }

    private static Optional<HochzeitStatus> hochzeitStatus(SpielEntity spielEntity, List<VorbehaltMeldung> vorbehalte) {
        if (spielEntity.hochzeitSpielerPosition() != null) {
            return Optional.of(new HochzeitStatus(
                spielEntity.hochzeitSpielerPosition(),
                spielEntity.hochzeitGeklaerteStiche(),
                spielEntity.hochzeitPartnerSpielerPosition(),
                spielEntity.hochzeitStillesSolo()
            ));
        }
        if (!istAufgeloest(spielEntity.phasenName())) {
            return Optional.empty();
        }
        return hoechsterVorbehalt(vorbehalte)
            .filter(meldung -> meldung.ansage() == VorbehaltAnsage.HOCHZEIT)
            .map(meldung -> HochzeitStatus.gestartet(meldung.spielerPosition()));
    }

    private static Optional<ArmutStatus> armutStatus(SpielEntity spielEntity, List<VorbehaltMeldung> vorbehalte) {
        if (spielEntity.armutSpielerPosition() == null && !istAufgeloest(spielEntity.phasenName())) {
            return Optional.empty();
        }
        SpielerPosition armutSpieler = spielEntity.armutSpielerPosition();
        if (armutSpieler == null) {
            armutSpieler = hoechsterVorbehalt(vorbehalte)
                .filter(meldung -> meldung.ansage() == VorbehaltAnsage.ARMUT)
                .map(VorbehaltMeldung::spielerPosition)
                .orElse(null);
        }
        if (armutSpieler == null) {
            return Optional.empty();
        }
        SpielerPosition finalerArmutSpieler = armutSpieler;
        List<SpielerPosition> abfrageReihenfolge = SpielerPosition.imUhrzeigersinnAb(finalerArmutSpieler.naechsteImUhrzeigersinn()).stream()
            .filter(position -> position != finalerArmutSpieler)
            .toList();
        return Optional.of(new ArmutStatus(
            finalerArmutSpieler,
            abfrageReihenfolge,
            spielEntity.armutAktuellerAntwortIndex(),
            spielEntity.armutAngeboteneKarten().stream().map(SpielPersistenzAdapter::alsKarte).toList(),
            spielEntity.armutAngebotAbgegeben(),
            spielEntity.armutPartnerSpielerPosition()
        ));
    }

    private static Stich aktuellerStich(SpielEntity spielEntity) {
        if (!"STICHPHASE".equals(spielEntity.phasenName())) {
            return null;
        }
        if (spielEntity.aktuellerStichAufspielerPosition() != null) {
            return Stich.ausPersistiertemStand(
                spielEntity.aktuellerStichAufspielerPosition(),
                spielEntity.aktuellerStichKarten().stream()
                    .map(SpielPersistenzAdapter::alsGespielteKarte)
                    .toList()
            );
        }
        SpielerPosition aufspieler = spielEntity.stiche().isEmpty()
            ? spielEntity.geberPosition().naechsteImUhrzeigersinn()
            : spielEntity.stiche().getLast().gewinnerPosition();
        return Stich.neu(aufspieler);
    }

    private static List<Stich> abgeschlosseneStiche(SpielEntity spielEntity) {
        return spielEntity.stiche().stream()
            .map(SpielPersistenzAdapter::alsStich)
            .toList();
    }

    private static Optional<Spielergebnis> spielergebnis(SpielEntity spielEntity) {
        if (spielEntity.ergebnis() == null) {
            return Optional.empty();
        }
        EnumMap<Partei, Augen> augenProPartei = new EnumMap<>(Partei.class);
        augenProPartei.put(Partei.RE, new Augen(spielEntity.ergebnis().reAugen()));
        augenProPartei.put(Partei.KONTRA, new Augen(spielEntity.ergebnis().kontraAugen()));

        EnumMap<SpielerPosition, Spielpunkte> spielpunkteProSpieler = new EnumMap<>(SpielerPosition.class);
        spielpunkteProSpieler.put(SpielerPosition.SUED, new Spielpunkte(spielEntity.ergebnis().spielpunkteSued()));
        spielpunkteProSpieler.put(SpielerPosition.WEST, new Spielpunkte(spielEntity.ergebnis().spielpunkteWest()));
        spielpunkteProSpieler.put(SpielerPosition.NORD, new Spielpunkte(spielEntity.ergebnis().spielpunkteNord()));
        spielpunkteProSpieler.put(SpielerPosition.OST, new Spielpunkte(spielEntity.ergebnis().spielpunkteOst()));

        EnumMap<Partei, List<SonderpunktEreignis>> sonderpunkteProPartei = new EnumMap<>(Partei.class);
        sonderpunkteProPartei.put(Partei.RE, spielEntity.sonderpunkte().stream()
            .filter(eintrag -> eintrag.partei() == Partei.RE)
            .map(SpielSonderpunktEntity::alsEreignis)
            .toList());
        sonderpunkteProPartei.put(Partei.KONTRA, spielEntity.sonderpunkte().stream()
            .filter(eintrag -> eintrag.partei() == Partei.KONTRA)
            .map(SpielSonderpunktEntity::alsEreignis)
            .toList());

        SpielErgebnisEmbeddable ergebnis = spielEntity.ergebnis();
        Integer dbGrundwert = ergebnis.grundwert();
        Integer dbAbsagePunkte = ergebnis.absagePunkte();
        Integer dbGegenDieAltenPunkte = ergebnis.gegenDieAltenPunkte();
        Integer dbSoloMultiplikator = ergebnis.soloMultiplikator();

        return Optional.of(new Spielergebnis(
            augenProPartei,
            ergebnis.siegerPartei(),
            new Spielpunkte(ergebnis.spielwert()),
            dbGrundwert != null ? dbGrundwert : ergebnis.spielwert(),
            dbAbsagePunkte != null ? dbAbsagePunkte : 0,
            dbGegenDieAltenPunkte != null ? dbGegenDieAltenPunkte : 0,
            dbSoloMultiplikator != null ? dbSoloMultiplikator : 1,
            spielpunkteProSpieler,
            sonderpunkteProPartei
        ));
    }

    private static List<Karte> alleKarten(SpielEntity spielEntity) {
        List<Karte> karten = new ArrayList<>();
        spielEntity.haende().forEach(hand -> hand.karten().forEach(karte -> karten.add(alsKarte(karte))));
        spielEntity.stiche().forEach(stich -> stich.gespielteKarten().forEach(karte -> karten.add(alsKarte(karte))));
        spielEntity.aktuellerStichKarten().forEach(karte -> karten.add(alsKarte(karte)));
        if ("ARMUT_TAUSCH".equals(spielEntity.phasenName()) && spielEntity.armutPartnerSpielerPosition() == null) {
            spielEntity.armutAngeboteneKarten().forEach(karte -> karten.add(alsKarte(karte)));
        }
        return karten;
    }

    private static boolean hatKreuzDame(SpielEntity spielEntity, Map<SpielerPosition, Hand> haende, SpielerPosition position) {
        Hand hand = haende.get(position);
        boolean inHand = hand != null && hand.karten().stream().anyMatch(SpielPersistenzAdapter::istKreuzDame);
        if (inHand) {
            return true;
        }
        boolean inAbgeschlossenenStichen = spielEntity.stiche().stream()
            .flatMap(stich -> stich.gespielteKarten().stream())
            .filter(karte -> karte.spielerPosition() == position)
            .map(SpielPersistenzAdapter::alsKarte)
            .anyMatch(SpielPersistenzAdapter::istKreuzDame);
        if (inAbgeschlossenenStichen) {
            return true;
        }
        return spielEntity.aktuellerStichKarten().stream()
            .filter(karte -> karte.spielerPosition() == position)
            .map(SpielPersistenzAdapter::alsKarte)
            .anyMatch(SpielPersistenzAdapter::istKreuzDame);
    }

    private static boolean istKreuzDame(Karte karte) {
        return karte.farbe() == Farbe.KREUZ && karte.wert() == Kartenwert.DAME;
    }

    /**
     * Erkennt den stilles-Solo-Spieler bei Gesund-Meldungen: Zaehlt Kreuz-Damen
     * ueber alle Quellen (Hand, abgeschlossene Stiche, aktueller Stich).
     * Gibt den Spieler mit &ge;2 Kreuz-Damen zurueck, oder null falls nicht eindeutig.
     */
    private static SpielerPosition erkenneStillesSoloSpieler(
        Map<SpielerPosition, Hand> haende,
        SpielEntity spielEntity
    ) {
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            Hand hand = haende.get(position);
            long inHand = hand == null ? 0 : hand.karten().stream()
                .filter(SpielPersistenzAdapter::istKreuzDame).count();
            long inStichen = spielEntity.stiche().stream()
                .flatMap(s -> s.gespielteKarten().stream())
                .filter(k -> k.spielerPosition() == position)
                .map(SpielPersistenzAdapter::alsKarte)
                .filter(SpielPersistenzAdapter::istKreuzDame).count();
            long imAktuellenStich = spielEntity.aktuellerStichKarten().stream()
                .filter(k -> k.spielerPosition() == position)
                .map(SpielPersistenzAdapter::alsKarte)
                .filter(SpielPersistenzAdapter::istKreuzDame).count();
            if (inHand + inStichen + imAktuellenStich >= 2) {
                return position;
            }
        }
        return null;
    }

    private static Karte alsKarte(HandKarteEmbeddable karte) {
        return new Karte(karte.farbe(), karte.wert(), karte.exemplarIndex());
    }

    private static Karte alsKarte(AktuellerStichKarteEmbeddable karte) {
        return new Karte(karte.farbe(), karte.wert(), karte.exemplarIndex());
    }

    private static GespielteKarte alsGespielteKarte(AktuellerStichKarteEmbeddable karte) {
        return new GespielteKarte(
            karte.spielerPosition(),
            alsKarte(karte),
            karte.reihenfolge()
        );
    }

    private static Stich alsStich(StichJsonEintrag stichEintrag) {
        return Stich.ausPersistiertemStand(
            stichEintrag.aufspielerPosition(),
            stichEintrag.gespielteKarten().stream().map(SpielPersistenzAdapter::alsGespielteKarte).toList()
        );
    }

    private static List<StichJsonEintrag> alsStichJsonEintraege(Spiel spiel) {
        List<StichJsonEintrag> stiche = new ArrayList<>();
        int index = 1;
        for (Stich stich : spiel.abgeschlosseneStiche()) {
            List<AktuellerStichKarteEmbeddable> gespielteKarten = stich.gespielteKarten().stream()
                .map(AktuellerStichKarteEmbeddable::aus)
                .toList();
            stiche.add(new StichJsonEintrag(
                index,
                stich.aufspieler(),
                stich.gewinner(spiel.trumpfOrdnung()).spieler(),
                stich.augen().wert(),
                gespielteKarten
            ));
            index++;
        }
        return List.copyOf(stiche);
    }

    private static Optional<VorbehaltMeldung> hoechsterVorbehalt(List<VorbehaltMeldung> vorbehalte) {
        VorbehaltMeldung hoechsterVorbehalt = null;
        for (VorbehaltMeldung meldung : vorbehalte) {
            if (!meldung.istVorbehalt()) {
                continue;
            }
            if (hoechsterVorbehalt == null || meldung.ansage().prioritaet() > hoechsterVorbehalt.ansage().prioritaet()) {
                hoechsterVorbehalt = meldung;
            }
        }
        return Optional.ofNullable(hoechsterVorbehalt);
    }

    private static boolean istAufgeloest(String phasenName) {
        return switch (phasenName) {
            case "ARMUT_TAUSCH", "STICHPHASE", "AUSWERTUNG", "GESAMTSTAND_AKTUALISIEREN" -> true;
            default -> false;
        };
    }

    private static Set<Partei> pflichtansageAusstehend(SpielEntity spielEntity) {
        List<String> namen = spielEntity.pflichtansageAusstehend();
        if (namen.isEmpty()) {
            return Set.of();
        }
        EnumSet<Partei> ergebnis = EnumSet.noneOf(Partei.class);
        for (String name : namen) {
            ergebnis.add(Partei.valueOf(name));
        }
        return Set.copyOf(ergebnis);
    }
}
