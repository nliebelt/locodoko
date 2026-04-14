package de.locodoko.tisch;

import de.locodoko.karten.Karte;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.karten.Spieltyp;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.AnsageEreignis;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Sonderpunkt;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.HandEntity;
import de.locodoko.partie.PartieEntity;
import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.SpielEntity;
import de.locodoko.partie.SpielErgebnisEmbeddable;
import de.locodoko.session.SpielerEntity;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST- und WebSocket-Snapshot des aktuellen Partiestands.
 *
 * <p>Wird nach jeder spielrelevanten Aktion sowohl per REST ({@code GET /api/partien/{id}/stand})
 * als auch per WebSocket-Broadcast an alle Partie-Teilnehmer gesendet. Der Snapshot ist
 * spieler-spezifisch: Die eigene Hand ist vollstaendig sichtbar, Gegnerhaende werden nur
 * als Anzahl angegeben. Liefert alle Informationen, die Frontend und KI benoetigen:
 * aktuelle Phase, moegliche Aktionen, Stichmitte, Ansage-Historie, letztes Spielergebnis
 * und die abgeschlossenen Stiche des letzten Spiels.</p>
 */
public record PartieStandAntwort(
    UUID partieId,
    PartieStatus status,
    int anzahlSpiele,
    int gespielteSpiele,
    Map<SpielerPosition, Integer> gesamtpunktestand,
    LetztesSpielergebnisAntwort letztesSpielergebnis,
    List<AbgeschlossenerStichAntwort> letzteAbgeschlosseneStiche,
    LaufendesSpielAntwort laufendesSpiel
) {

    public static PartieStandAntwort aus(PartieEntity partie) {
        return aus(partie, null, false);
    }

    public static PartieStandAntwort aus(PartieEntity partie, UUID sichtbarerSpielerId) {
        return aus(partie, sichtbarerSpielerId, false);
    }

    public static PartieStandAntwort aus(PartieEntity partie, UUID sichtbarerSpielerId, boolean debugModus) {
        SpielEntity laufendesSpiel = partie.spiele().stream()
            .filter(spiel -> spiel.ergebnis() == null)
            .reduce((erstes, zweites) -> zweites)
            .orElse(null);
        SpielEntity letztesAbgeschlossenesSpiel = partie.spiele().stream()
            .filter(spiel -> spiel.ergebnis() != null)
            .reduce((erstes, zweites) -> zweites)
            .orElse(null);
        return new PartieStandAntwort(
            partie.id(),
            partie.status(),
            partie.anzahlSpiele(),
            partie.spiele().stream().filter(spiel -> spiel.ergebnis() != null).toList().size(),
            partie.gesamtpunktestand(),
            LetztesSpielergebnisAntwort.aus(letztesAbgeschlossenesSpiel),
            AbgeschlossenerStichAntwort.aus(laufendesSpiel != null ? laufendesSpiel : letztesAbgeschlossenesSpiel),
            LaufendesSpielAntwort.aus(partie, laufendesSpiel, sichtbarerSpielerId, debugModus)
        );
    }

    public record LaufendesSpielAntwort(
        int spielNummer,
        Spieltyp spieltyp,
        String phase,
        SpielerPosition geber,
        SpielerPosition aktuellerSpieler,
        List<SpielerImSpielAntwort> spieler,
        List<KarteAntwort> spielbareKarten,
        List<GespielteKarteAntwort> aktuelleStichmitte,
        List<AnsageEreignisAntwort> ansageHistorie,
        List<Ansage> moeglicheAnsagen,
        List<VorbehaltAnsage> moeglicheVorbehalte,
        boolean istBockrunde
    ) {

        static LaufendesSpielAntwort aus(PartieEntity partie, SpielEntity laufendesSpiel, UUID sichtbarerSpielerId, boolean debugModus) {
            if (laufendesSpiel == null) {
                return null;
            }

            Map<SpielerPosition, SpielerEntity> spielerNachPosition = spielerNachPosition(partie);
            SpielerPosition sichtbarePosition = positionVonSpieler(spielerNachPosition, sichtbarerSpielerId);
            Spiel fachlichesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpiel);
            SpielerPosition aktuellerSpieler = aktuellerSpieler(fachlichesSpiel);
            boolean zeigeAlleHaende = debugModus && sichtbarePosition != null;
            Map<SpielerPosition, Integer> gewonneneStiche = SpielPersistenzAdapter.gewonneneStiche(laufendesSpiel);

            List<SpielerImSpielAntwort> spieler = new ArrayList<>();
            for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
                HandEntity hand = handVon(laufendesSpiel, position);
                spieler.add(SpielerImSpielAntwort.aus(
                    position,
                    spielerNachPosition.get(position),
                    hand,
                    sichtbarePosition,
                    aktuellerSpieler,
                    laufendesSpiel.geberPosition(),
                    zeigeAlleHaende,
                    gewonneneStiche.getOrDefault(position, 0),
                    parteiSicht(fachlichesSpiel, sichtbarePosition, position)
                ));
            }

            return new LaufendesSpielAntwort(
                laufendesSpiel.spielNummer(),
                laufendesSpiel.spieltyp(),
                laufendesSpiel.phasenName(),
                laufendesSpiel.geberPosition(),
                aktuellerSpieler,
                spieler,
                sichtbarePosition != null && sichtbarePosition == aktuellerSpieler && fachlichesSpiel.phase() instanceof Spielphase.Stichphase
                    ? fachlichesSpiel.gueltigeKartenFuer(sichtbarePosition).stream().map(KarteAntwort::aus).toList()
                    : List.of(),
                fachlichesSpiel.aktuellerStich()
                    .map(stich -> stich.gespielteKarten().stream().map(GespielteKarteAntwort::aus).toList())
                    .orElse(List.of()),
                fachlichesSpiel.ansagen().ereignisse().stream().map(AnsageEreignisAntwort::aus).toList(),
                bestimmeMoeglicheAnsagen(fachlichesSpiel, sichtbarePosition, aktuellerSpieler),
                bestimmeMoeglicheVorbehalte(fachlichesSpiel, sichtbarePosition, aktuellerSpieler),
                partie.bockrundenZaehler() > 0
            );
        }

        private static List<VorbehaltAnsage> bestimmeMoeglicheVorbehalte(
            Spiel laufendesSpiel,
            SpielerPosition sichtbarePosition,
            SpielerPosition aktuellerSpieler
        ) {
            if (sichtbarePosition == null || sichtbarePosition != aktuellerSpieler || !(laufendesSpiel.phase() instanceof Spielphase.VorbehaltAnsage)) {
                return List.of();
            }
            return List.of(VorbehaltAnsage.values()).stream()
                .filter(ansage -> ansage.istZulaessig(laufendesSpiel.handVon(sichtbarePosition), laufendesSpiel.spielregeln()))
                .toList();
        }

        private static List<Ansage> bestimmeMoeglicheAnsagen(
            Spiel laufendesSpiel,
            SpielerPosition sichtbarePosition,
            SpielerPosition aktuellerSpieler
        ) {
            if (sichtbarePosition == null || sichtbarePosition != aktuellerSpieler || !(laufendesSpiel.phase() instanceof Spielphase.Stichphase)) {
                return List.of();
            }
            return List.of(Ansage.values()).stream()
                .filter(ansage -> laufendesSpiel.kannAnsagen(sichtbarePosition, ansage))
                .toList();
        }

        private static Partei parteiSicht(Spiel laufendesSpiel, SpielerPosition sichtbarePosition, SpielerPosition zielPosition) {
            if (sichtbarePosition == null) {
                return null;
            }
            try {
                // Parteisichtbarkeit kommt ausschliesslich aus dem Domainmodell (parteien.offenFuerAlle),
                // das bei Grundansagen, Solo, Hochzeit und Armut serverseitig aktualisiert wird.
                return laufendesSpiel.parteien().sichtAufPartei(sichtbarePosition, zielPosition)
                    .orElse(null);
            } catch (IllegalStateException ignored) {
                return null;
            }
        }

        private static SpielerPosition aktuellerSpieler(Spiel laufendesSpiel) {
            return laufendesSpiel.erwarteterSpieler().orElse(null);
        }

        private static Map<SpielerPosition, SpielerEntity> spielerNachPosition(PartieEntity partie) {
            EnumMap<SpielerPosition, SpielerEntity> spielerNachPosition = new EnumMap<>(SpielerPosition.class);
            List<SpielerEntity> spieler = partie.tisch().spieler();
            List<SpielerPosition> positionen = SpielerPosition.standardReihenfolge();
            for (int index = 0; index < spieler.size() && index < positionen.size(); index++) {
                spielerNachPosition.put(positionen.get(index), spieler.get(index));
            }
            return Map.copyOf(spielerNachPosition);
        }

        private static SpielerPosition positionVonSpieler(Map<SpielerPosition, SpielerEntity> spielerNachPosition, UUID sichtbarerSpielerId) {
            if (sichtbarerSpielerId == null) {
                return null;
            }
            return spielerNachPosition.entrySet().stream()
                .filter(eintrag -> sichtbarerSpielerId.equals(eintrag.getValue().id()))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(null);
        }

        private static HandEntity handVon(SpielEntity laufendesSpiel, SpielerPosition position) {
            return laufendesSpiel.haende().stream()
                .filter(hand -> hand.spielerPosition() == position)
                .findFirst()
                .orElse(null);
        }
    }

    public record SpielerImSpielAntwort(
        SpielerPosition position,
        UUID spielerId,
        String name,
        boolean istKi,
        boolean istSelbst,
        boolean istGeber,
        boolean istAmZug,
        Integer verbleibendeKarten,
        int gewonneneStiche,
        Partei partei,
        List<KarteAntwort> sichtbareHandkarten
    ) {

        static SpielerImSpielAntwort aus(
            SpielerPosition position,
            SpielerEntity spielerEntity,
            HandEntity hand,
            SpielerPosition sichtbarePosition,
            SpielerPosition aktuellerSpieler,
            SpielerPosition geberPosition,
            boolean zeigeAlleHaende,
            int gewonneneStiche,
            Partei partei
        ) {
            List<KarteAntwort> sichtbareHandkarten = hand != null && (zeigeAlleHaende || position == sichtbarePosition)
                ? hand.karten().stream()
                    .map(karte -> new Karte(karte.farbe(), karte.wert(), karte.exemplarIndex()))
                    .map(KarteAntwort::aus)
                    .toList()
                : null;
            return new SpielerImSpielAntwort(
                position,
                spielerEntity == null ? null : spielerEntity.id(),
                spielerEntity == null ? "Unbesetzt" : spielerEntity.name(),
                spielerEntity != null && spielerEntity.istKi(),
                position == sichtbarePosition,
                position == geberPosition,
                position == aktuellerSpieler,
                hand == null ? null : hand.karten().size(),
                gewonneneStiche,
                partei,
                sichtbareHandkarten
            );
        }
    }

    public record KarteAntwort(String id, String farbe, String wert, int exemplarIndex) {

        static KarteAntwort aus(Karte karte) {
            return new KarteAntwort(
                "%s-%s-%d".formatted(karte.farbe().name(), karte.wert().name(), karte.exemplarIndex()),
                karte.farbe().name(),
                karte.wert().name(),
                karte.exemplarIndex()
            );
        }
    }

    public record GespielteKarteAntwort(SpielerPosition spielerPosition, KarteAntwort karte, int reihenfolge) {

        static GespielteKarteAntwort aus(de.locodoko.karten.GespielteKarte gespielteKarte) {
            return new GespielteKarteAntwort(
                gespielteKarte.spieler(),
                KarteAntwort.aus(gespielteKarte.karte()),
                gespielteKarte.reihenfolge()
            );
        }

        static GespielteKarteAntwort aus(de.locodoko.partie.GespielteKarteEntity gespielteKarte) {
            return new GespielteKarteAntwort(
                gespielteKarte.spielerPosition(),
                new KarteAntwort(
                    "%s-%s-%d".formatted(gespielteKarte.farbe().name(), gespielteKarte.wert().name(), gespielteKarte.exemplarIndex()),
                    gespielteKarte.farbe().name(),
                    gespielteKarte.wert().name(),
                    gespielteKarte.exemplarIndex()
                ),
                gespielteKarte.reihenfolge()
            );
        }
    }

    public record AnsageEreignisAntwort(SpielerPosition spielerPosition, Ansage ansage) {

        static AnsageEreignisAntwort aus(AnsageEreignis ereignis) {
            return new AnsageEreignisAntwort(ereignis.spieler(), ereignis.ansage());
        }
    }

    public record AbgeschlossenerStichAntwort(
        int spielNummer,
        int stichNummer,
        SpielerPosition aufspielerPosition,
        SpielerPosition gewinnerPosition,
        int augen,
        List<GespielteKarteAntwort> gespielteKarten
    ) {

        static List<AbgeschlossenerStichAntwort> aus(SpielEntity spiel) {
            if (spiel == null) {
                return List.of();
            }
            return spiel.stiche().stream()
                .map(stich -> new AbgeschlossenerStichAntwort(
                    spiel.spielNummer(),
                    stich.stichNummer(),
                    stich.aufspielerPosition(),
                    stich.gewinnerPosition(),
                    stich.augen(),
                    stich.gespielteKarten().stream().map(GespielteKarteAntwort::aus).toList()
                ))
                .toList();
        }
    }

    public record SonderpunktEreignisDto(
        Sonderpunkt art,
        SpielerPosition taeter,
        SpielerPosition opfer
    ) {}

    public record LetztesSpielergebnisAntwort(
        int spielNummer,
        Spieltyp spieltyp,
        Partei siegerPartei,
        int spielwert,
        int grundwert,
        int absagePunkte,
        int gegenDieAltenPunkte,
        int soloMultiplikator,
        Map<Partei, Integer> augenProPartei,
        Map<SpielerPosition, Integer> spielpunkteProSpieler,
        Map<Partei, List<SonderpunktEreignisDto>> sonderpunkteProPartei
    ) {

        static LetztesSpielergebnisAntwort aus(SpielEntity spiel) {
            if (spiel == null || spiel.ergebnis() == null) {
                return null;
            }

            SpielErgebnisEmbeddable ergebnis = spiel.ergebnis();
            EnumMap<Partei, Integer> augenProPartei = new EnumMap<>(Partei.class);
            augenProPartei.put(Partei.RE, ergebnis.reAugen());
            augenProPartei.put(Partei.KONTRA, ergebnis.kontraAugen());

            EnumMap<SpielerPosition, Integer> spielpunkteProSpieler = new EnumMap<>(SpielerPosition.class);
            spielpunkteProSpieler.put(SpielerPosition.SUED, ergebnis.spielpunkteSued());
            spielpunkteProSpieler.put(SpielerPosition.WEST, ergebnis.spielpunkteWest());
            spielpunkteProSpieler.put(SpielerPosition.NORD, ergebnis.spielpunkteNord());
            spielpunkteProSpieler.put(SpielerPosition.OST, ergebnis.spielpunkteOst());

            EnumMap<Partei, List<SonderpunktEreignisDto>> sonderpunkteProPartei = new EnumMap<>(Partei.class);
            for (Partei partei : Partei.values()) {
                sonderpunkteProPartei.put(
                    partei,
                    spiel.sonderpunkte().stream()
                        .filter(sp -> sp.partei() == partei)
                        .map(sp -> new SonderpunktEreignisDto(sp.sonderpunkt(), sp.taeter(), sp.opfer()))
                        .toList()
                );
            }

            Integer dbGrundwert = ergebnis.grundwert();
            Integer dbAbsagePunkte = ergebnis.absagePunkte();
            Integer dbGegenDieAltenPunkte = ergebnis.gegenDieAltenPunkte();
            Integer dbSoloMultiplikator = ergebnis.soloMultiplikator();

            return new LetztesSpielergebnisAntwort(
                spiel.spielNummer(),
                spiel.spieltyp(),
                ergebnis.siegerPartei(),
                ergebnis.spielwert(),
                dbGrundwert != null ? dbGrundwert : ergebnis.spielwert(),
                dbAbsagePunkte != null ? dbAbsagePunkte : 0,
                dbGegenDieAltenPunkte != null ? dbGegenDieAltenPunkte : 0,
                dbSoloMultiplikator != null ? dbSoloMultiplikator : 1,
                Map.copyOf(augenProPartei),
                Map.copyOf(spielpunkteProSpieler),
                Map.copyOf(sonderpunkteProPartei)
            );
        }
    }
}
