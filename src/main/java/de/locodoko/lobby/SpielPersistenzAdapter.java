package de.locodoko.lobby;

import de.locodoko.karten.Hand;
import de.locodoko.karten.GespielteKarte;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Stich;
import de.locodoko.partie.AnsageEreignis;
import de.locodoko.partie.Ansagen;
import de.locodoko.partie.ArmutStatus;
import de.locodoko.partie.HochzeitStatus;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.Sonderpunkt;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.VorbehaltMeldung;
import de.locodoko.partie.AnsageEreignisEmbeddable;
import de.locodoko.partie.AktuellerStichKarteEmbeddable;
import de.locodoko.partie.GespielteKarteEntity;
import de.locodoko.partie.HandEntity;
import de.locodoko.partie.HandKarteEmbeddable;
import de.locodoko.partie.SpielEntity;
import de.locodoko.partie.SpielSonderpunktEntity;
import de.locodoko.partie.StichEntity;
import de.locodoko.partie.VorbehaltMeldungEmbeddable;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

final class SpielPersistenzAdapter {

    private SpielPersistenzAdapter() {
    }

    static Spiel zuDomainSpiel(SpielEntity spielEntity) {
        Objects.requireNonNull(spielEntity, "spielEntity darf nicht null sein");
        Map<SpielerPosition, Hand> haende = haende(spielEntity);
        List<VorbehaltMeldung> vorbehalte = vorbehalte(spielEntity);
        Ansagen ansagen = ansagen(spielEntity);
        List<Stich> abgeschlosseneStiche = abgeschlosseneStiche(spielEntity);
        return Spiel.ausPersistiertemStand(
            spielEntity.partie().tisch().konfiguration().alsSpielregeln(),
            Kartendeck.ausKarten(alleKarten(spielEntity)),
            spielEntity.spieltyp(),
            spielEntity.geberPosition(),
            spielEntity.phase(),
            haende,
            vorbehalte,
            parteien(spielEntity, haende, vorbehalte).orElse(null),
            ansagen,
            abgeschlosseneStiche,
            aktuellerStich(spielEntity),
            spielergebnis(spielEntity).orElse(null),
            hochzeitStatus(spielEntity, vorbehalte).orElse(null),
            armutStatus(spielEntity, vorbehalte).orElse(null)
        );
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
            .map(position -> HandEntity.neu(position, quelle.handVon(position).karten()))
            .toList());
        ziel.ersetzeStiche(alsStichEntities(quelle));
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
        for (HandEntity hand : spielEntity.haende()) {
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
        List<VorbehaltMeldung> vorbehalte
    ) {
        if (!istAufgeloest(spielEntity.phase())) {
            return Optional.empty();
        }
        VorbehaltMeldung hoechsterVorbehalt = hoechsterVorbehalt(vorbehalte).orElse(null);
        if (hoechsterVorbehalt == null) {
            return Optional.of(parteienFuerNormalspiel(spielEntity, haende));
        }
        return switch (hoechsterVorbehalt.ansage()) {
            case SOLO_DAME, SOLO_BUBE, SOLO_TRUMPF, SOLO_FLEISCHLOS ->
                Optional.of(Parteien.ausSolo(hoechsterVorbehalt.spielerPosition()));
            case HOCHZEIT -> Optional.of(parteienFuerHochzeit(spielEntity, hoechsterVorbehalt.spielerPosition()));
            case ARMUT -> Optional.of(parteienFuerArmut(spielEntity, hoechsterVorbehalt.spielerPosition()));
            case GESUND -> Optional.empty();
        };
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
        if (!istAufgeloest(spielEntity.phase())) {
            return Optional.empty();
        }
        return hoechsterVorbehalt(vorbehalte)
            .filter(meldung -> meldung.ansage() == VorbehaltAnsage.HOCHZEIT)
            .map(meldung -> HochzeitStatus.gestartet(meldung.spielerPosition()));
    }

    private static Optional<ArmutStatus> armutStatus(SpielEntity spielEntity, List<VorbehaltMeldung> vorbehalte) {
        if (spielEntity.armutSpielerPosition() == null && !istAufgeloest(spielEntity.phase())) {
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
        if (spielEntity.phase() != Spielphase.STICHPHASE) {
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
        EnumMap<Partei, Integer> augenProPartei = new EnumMap<>(Partei.class);
        augenProPartei.put(Partei.RE, spielEntity.ergebnis().reAugen());
        augenProPartei.put(Partei.KONTRA, spielEntity.ergebnis().kontraAugen());

        EnumMap<SpielerPosition, Integer> spielpunkteProSpieler = new EnumMap<>(SpielerPosition.class);
        spielpunkteProSpieler.put(SpielerPosition.SUED, spielEntity.ergebnis().spielpunkteSued());
        spielpunkteProSpieler.put(SpielerPosition.WEST, spielEntity.ergebnis().spielpunkteWest());
        spielpunkteProSpieler.put(SpielerPosition.NORD, spielEntity.ergebnis().spielpunkteNord());
        spielpunkteProSpieler.put(SpielerPosition.OST, spielEntity.ergebnis().spielpunkteOst());

        EnumMap<Partei, List<Sonderpunkt>> sonderpunkteProPartei = new EnumMap<>(Partei.class);
        sonderpunkteProPartei.put(Partei.RE, spielEntity.sonderpunkte().stream()
            .filter(eintrag -> eintrag.partei() == Partei.RE)
            .map(SpielSonderpunktEntity::sonderpunkt)
            .toList());
        sonderpunkteProPartei.put(Partei.KONTRA, spielEntity.sonderpunkte().stream()
            .filter(eintrag -> eintrag.partei() == Partei.KONTRA)
            .map(SpielSonderpunktEntity::sonderpunkt)
            .toList());

        return Optional.of(new Spielergebnis(
            augenProPartei,
            spielEntity.ergebnis().siegerPartei(),
            spielEntity.ergebnis().spielwert(),
            spielpunkteProSpieler,
            sonderpunkteProPartei
        ));
    }

    private static List<Karte> alleKarten(SpielEntity spielEntity) {
        List<Karte> karten = new ArrayList<>();
        spielEntity.haende().forEach(hand -> hand.karten().forEach(karte -> karten.add(alsKarte(karte))));
        spielEntity.stiche().forEach(stich -> stich.gespielteKarten().forEach(karte -> karten.add(alsKarte(karte))));
        spielEntity.aktuellerStichKarten().forEach(karte -> karten.add(alsKarte(karte)));
        if (spielEntity.phase() == Spielphase.ARMUT_TAUSCH && spielEntity.armutPartnerSpielerPosition() == null) {
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
        return karte.farbe() == de.locodoko.karten.Farbe.KREUZ
            && karte.wert() == de.locodoko.karten.Kartenwert.DAME;
    }

    private static Karte alsKarte(HandKarteEmbeddable karte) {
        return new Karte(karte.farbe(), karte.wert(), karte.exemplarIndex());
    }

    private static Karte alsKarte(GespielteKarteEntity karte) {
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

    private static GespielteKarte alsGespielteKarte(GespielteKarteEntity karte) {
        return new GespielteKarte(
            karte.spielerPosition(),
            alsKarte(karte),
            karte.reihenfolge()
        );
    }

    private static Stich alsStich(StichEntity stichEntity) {
        return Stich.ausPersistiertemStand(
            stichEntity.aufspielerPosition(),
            stichEntity.gespielteKarten().stream().map(SpielPersistenzAdapter::alsGespielteKarte).toList()
        );
    }

    private static List<StichEntity> alsStichEntities(Spiel spiel) {
        List<StichEntity> stiche = new ArrayList<>();
        int index = 1;
        for (Stich stich : spiel.abgeschlosseneStiche()) {
            StichEntity stichEntity = StichEntity.neu(
                index,
                stich.aufspieler(),
                stich.gewinner(spiel.trumpfOrdnung()).spieler(),
                stich.augen()
            );
            for (GespielteKarte gespielteKarte : stich.gespielteKarten()) {
                stichEntity.fuegeGespielteKarteHinzu(
                    GespielteKarteEntity.neu(gespielteKarte.spieler(), gespielteKarte.karte(), gespielteKarte.reihenfolge())
                );
            }
            stiche.add(stichEntity);
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

    private static boolean istAufgeloest(Spielphase phase) {
        return switch (phase) {
            case ARMUT_TAUSCH, STICHPHASE, AUSWERTUNG, GESAMTSTAND_AKTUALISIEREN -> true;
            default -> false;
        };
    }
}
