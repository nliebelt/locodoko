package de.locodoko.spielverwaltung.tisch;

import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.karten.Spieltyp;
import de.locodoko.spiel.partie.Ansage;
import de.locodoko.spiel.partie.Partei;
import de.locodoko.spiel.partie.Spielphase;
import de.locodoko.spiel.partie.VorbehaltAnsage;
import de.locodoko.spielverwaltung.persistenz.HandEntity;
import de.locodoko.spielverwaltung.persistenz.PartieEntity;
import de.locodoko.spielverwaltung.persistenz.PartieStatus;
import de.locodoko.spielverwaltung.persistenz.SpielEntity;
import de.locodoko.spielverwaltung.persistenz.SpielerEntity;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record PartieStandAntwort(
    UUID partieId,
    PartieStatus status,
    int anzahlSpiele,
    int gespielteSpiele,
    Map<SpielerPosition, Integer> gesamtpunktestand,
    LaufendesSpielAntwort laufendesSpiel
) {

    public static PartieStandAntwort aus(PartieEntity partie) {
        return aus(partie, null);
    }

    public static PartieStandAntwort aus(PartieEntity partie, UUID sichtbarerSpielerId) {
        SpielEntity laufendesSpiel = partie.spiele().stream()
            .filter(spiel -> spiel.ergebnis() == null)
            .reduce((erstes, zweites) -> zweites)
            .orElse(null);
        return new PartieStandAntwort(
            partie.id(),
            partie.status(),
            partie.anzahlSpiele(),
            partie.spiele().stream().filter(spiel -> spiel.ergebnis() != null).toList().size(),
            partie.gesamtpunktestand(),
            LaufendesSpielAntwort.aus(partie, laufendesSpiel, sichtbarerSpielerId)
        );
    }

    public record LaufendesSpielAntwort(
        int spielNummer,
        Spieltyp spieltyp,
        Spielphase phase,
        SpielerPosition geber,
        SpielerPosition aktuellerSpieler,
        List<SpielerImSpielAntwort> spieler,
        List<KarteAntwort> spielbareKarten,
        List<Ansage> moeglicheAnsagen,
        List<VorbehaltAnsage> moeglicheVorbehalte
    ) {

        static LaufendesSpielAntwort aus(PartieEntity partie, SpielEntity laufendesSpiel, UUID sichtbarerSpielerId) {
            if (laufendesSpiel == null) {
                return null;
            }

            Map<SpielerPosition, SpielerEntity> spielerNachPosition = spielerNachPosition(partie);
            SpielerPosition sichtbarePosition = positionVonSpieler(spielerNachPosition, sichtbarerSpielerId);
            SpielerPosition aktuellerSpieler = aktuellerSpieler(laufendesSpiel);

            List<SpielerImSpielAntwort> spieler = new ArrayList<>();
            for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
                HandEntity hand = handVon(laufendesSpiel, position);
                spieler.add(SpielerImSpielAntwort.aus(
                    position,
                    spielerNachPosition.get(position),
                    hand,
                    sichtbarePosition,
                    aktuellerSpieler,
                    laufendesSpiel.geberPosition()
                ));
            }

            return new LaufendesSpielAntwort(
                laufendesSpiel.spielNummer(),
                laufendesSpiel.spieltyp(),
                laufendesSpiel.phase(),
                laufendesSpiel.geberPosition(),
                aktuellerSpieler,
                spieler,
                sichtbarePosition != null && sichtbarePosition == aktuellerSpieler
                    ? sichtbareHandkarten(laufendesSpiel, sichtbarePosition)
                    : List.of(),
                List.of(),
                bestimmeMoeglicheVorbehalte(laufendesSpiel, sichtbarePosition, aktuellerSpieler)
            );
        }

        private static List<VorbehaltAnsage> bestimmeMoeglicheVorbehalte(
            SpielEntity laufendesSpiel,
            SpielerPosition sichtbarePosition,
            SpielerPosition aktuellerSpieler
        ) {
            if (sichtbarePosition == null || sichtbarePosition != aktuellerSpieler || laufendesSpiel.phase() != Spielphase.VORBEHALT_ANSAGE) {
                return List.of();
            }
            HandEntity hand = handVon(laufendesSpiel, sichtbarePosition);
            if (hand == null) {
                return List.of();
            }
            de.locodoko.spiel.karten.Hand fachlicheHand = new de.locodoko.spiel.karten.Hand(
                hand.karten().stream()
                    .map(karte -> new Karte(karte.farbe(), karte.wert(), karte.exemplarIndex()))
                    .toList()
            );
            return List.of(VorbehaltAnsage.values()).stream()
                .filter(ansage -> ansage.istZulaessig(fachlicheHand, laufendesSpiel.partie().tisch().konfiguration().alsSpielregeln()))
                .toList();
        }

        private static List<KarteAntwort> sichtbareHandkarten(SpielEntity laufendesSpiel, SpielerPosition sichtbarePosition) {
            HandEntity hand = handVon(laufendesSpiel, sichtbarePosition);
            if (hand == null) {
                return List.of();
            }
            return hand.karten().stream()
                .map(karte -> new Karte(karte.farbe(), karte.wert(), karte.exemplarIndex()))
                .map(KarteAntwort::aus)
                .toList();
        }

        private static SpielerPosition aktuellerSpieler(SpielEntity laufendesSpiel) {
            return switch (laufendesSpiel.phase()) {
                case VORBEHALT_ANSAGE -> laufendesSpiel.geberPosition().naechsteImUhrzeigersinn();
                default -> null;
            };
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
            SpielerPosition geberPosition
        ) {
            List<KarteAntwort> sichtbareHandkarten = position == sichtbarePosition && hand != null
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
                0,
                null,
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
}
