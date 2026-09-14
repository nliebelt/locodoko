package de.locodoko.tisch;

import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Spielregeln;
import de.locodoko.partie.ArmutStatus;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.karten.Spieltyp;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.AnsageEreignis;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Partie;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Sonderpunkt;
import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.Stich;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.VorbehaltMeldung;
import de.locodoko.partie.PartieStatus;
import de.locodoko.spieler.SpielerEntity;
import io.swagger.v3.oas.annotations.media.Schema;

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
@Schema(description = "Snapshot des aktuellen Partiestands fuer REST und WebSocket.")
public record PartieStandAntwort(
    @Schema(description = "Eindeutige Partie-ID.", example = "c3d4e5f6-7890-abcd-ef12-34567890abcd")
    UUID partieId,
    @Schema(description = "Aktuelle Sequenznummer/Version der Partie zur Synchronisation.", example = "42")
    long version,
    @Schema(description = "Aktueller Status der Partie.")
    PartieStatus status,
    @Schema(description = "Gesamtanzahl der Spiele in der Partie.", example = "12")
    int anzahlSpiele,
    @Schema(description = "Anzahl der bereits abgeschlossenen Spiele.", example = "3")
    int gespielteSpiele,
    @Schema(description = "Gesamtpunktestand pro Spielerposition.")
    Map<SpielerPosition, Integer> gesamtpunktestand,
    @Schema(description = "Ergebnis des letzten abgeschlossenen Spiels; null falls keines.")
    LetztesSpielergebnisAntwort letztesSpielergebnis,
    @Schema(description = "Ergebnisliste aller abgeschlossenen Spiele der aktuellen Partie.")
    List<LetztesSpielergebnisAntwort> spielverlauf,
    @Schema(description = "Abgeschlossene Stiche des aktuellen oder letzten Spiels.")
    List<AbgeschlossenerStichAntwort> letzteAbgeschlosseneStiche,
    @Schema(description = "Daten des aktuell laufenden Spiels; null falls keines laeuft.")
    LaufendesSpielAntwort laufendesSpiel
) {

    public static PartieStandAntwort aus(TischEntity tisch) {
        return aus(tisch, null, false);
    }

    public static PartieStandAntwort aus(TischEntity tisch, UUID sichtbarerSpielerId) {
        return aus(tisch, sichtbarerSpielerId, false);
    }

    public static PartieStandAntwort aus(TischEntity tisch, UUID sichtbarerSpielerId, boolean debugModus) {
        Partie partie = tisch.partie();
        Spielregeln spielregeln = tisch.konfiguration().alsSpielregeln();
        Spiel laufendesSpiel = partie.spiele().stream()
            .filter(spiel -> spiel.ergebnis().isEmpty())
            .reduce((erstes, zweites) -> zweites)
            .orElse(null);
        Spiel letztesAbgeschlossenesSpiel = partie.spiele().stream()
            .filter(spiel -> spiel.ergebnis().isPresent())
            .reduce((erstes, zweites) -> zweites)
            .orElse(null);
        return new PartieStandAntwort(
            partie.id(),
            partie.version(),
            partie.statusAusDb(),
            partie.anzahlSpieleAusDb(),
            partie.spiele().stream().filter(spiel -> spiel.ergebnis().isPresent()).toList().size(),
            partie.gesamtpunktestandAusDb(),
            LetztesSpielergebnisAntwort.aus(letztesAbgeschlossenesSpiel),
            partie.spiele().stream().filter(s -> s.ergebnis().isPresent()).map(LetztesSpielergebnisAntwort::aus).toList(),
            AbgeschlossenerStichAntwort.aus(laufendesSpiel != null ? laufendesSpiel : letztesAbgeschlossenesSpiel),
            LaufendesSpielAntwort.aus(tisch, laufendesSpiel, sichtbarerSpielerId, debugModus)
        );
        }

    @Schema(description = "Daten des aktuell laufenden Spiels innerhalb einer Partie.")
    public record LaufendesSpielAntwort(
        @Schema(description = "Laufende Nummer des Spiels in der Partie.", example = "1")
        int spielNummer,
        @Schema(description = "Typ des Spiels (Normal, Solo, Hochzeit, etc.).")
        Spieltyp spieltyp,
        @Schema(description = "Aktuelle Spielphase.", example = "STICHPHASE")
        String phase,
        @Schema(description = "Position des Gebers.")
        SpielerPosition geber,
        @Schema(description = "Position des Spielers, der am Zug ist.")
        SpielerPosition aktuellerSpieler,
        @Schema(description = "Alle Spieler im laufenden Spiel.")
        List<SpielerImSpielAntwort> spieler,
        @Schema(description = "Karten, die der aktuelle Spieler spielen darf.")
        List<KarteAntwort> spielbareKarten,
        @Schema(description = "Aktuell in der Stichmitte liegende Karten.")
        List<GespielteKarteAntwort> aktuelleStichmitte,
        @Schema(description = "Chronologische Historie aller Ansagen im Spiel.")
        List<AnsageEreignisAntwort> ansageHistorie,
        @Schema(description = "Ansagen, die der aktuelle Spieler machen darf.")
        List<Ansage> moeglicheAnsagen,
        @Schema(description = "Vorbehalte, die der aktuelle Spieler ansagen darf.")
        List<VorbehaltAnsage> moeglicheVorbehalte,
        @Schema(description = "Bereits deklarierte Vorbehalte der anderen Spieler (nur in der VorbehaltAnsage-Phase).")
        List<VorbehaltMeldungAntwort> deklarierteVorbehalte,
        @Schema(description = "Anzahl der aktiven Bockrunden (0 = keine Bockrunde).")
        int bockrundenZaehler,
        @Schema(description = "Ob eine Hochzeit bereits geklaert ist.")
        boolean hochzeitGeklaert,
        @Schema(description = "Ob Schweinchen (beide Karo-Asse bei einem Spieler) in diesem Spiel aktiv ist.")
        boolean schweinchenAktiv,
        @Schema(description = "Position des Spielers, der Schweinchen gemeldet hat; null falls keiner.")
        SpielerPosition schweinchenGemeldetVon,
        @Schema(description = "Position des Armut-Spielers; nur in der ARMUT_TAUSCH-Phase gesetzt, sonst null.")
        SpielerPosition armutSpielerPosition
    ) {

        static LaufendesSpielAntwort aus(TischEntity tisch, Spiel laufendesSpiel, UUID sichtbarerSpielerId, boolean debugModus) {
            if (laufendesSpiel == null) {
                return null;
            }

            Map<SpielerPosition, SpielerEntity> spielerNachPosition = spielerNachPosition(tisch);
            SpielerPosition sichtbarePosition = positionVonSpieler(spielerNachPosition, sichtbarerSpielerId);
            Spiel fachlichesSpiel = laufendesSpiel;
            SpielerPosition aktuellerSpieler = aktuellerSpieler(fachlichesSpiel);
            boolean zeigeAlleHaende = debugModus && sichtbarePosition != null;
            Map<SpielerPosition, Integer> gewonneneStiche = Spiel.gewonneneStiche(laufendesSpiel);

            List<SpielerImSpielAntwort> spieler = new ArrayList<>();
            for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
                Hand hand = handVon(laufendesSpiel, position);
                spieler.add(SpielerImSpielAntwort.aus(
                    position,
                    spielerNachPosition.get(position),
                    hand,
                    sichtbarePosition,
                    aktuellerSpieler,
                    laufendesSpiel.geber(),
                    zeigeAlleHaende,
                    gewonneneStiche.getOrDefault(position, 0),
                    parteiSicht(fachlichesSpiel, sichtbarePosition, position)
                ));
            }

            boolean hochzeitGeklaert = fachlichesSpiel.hochzeitStatus().isPresent() && fachlichesSpiel.hochzeitStatus().get().partner().isPresent();

            return new LaufendesSpielAntwort(
                laufendesSpiel.spielNummer(),
                laufendesSpiel.spieltyp(),
                laufendesSpiel.phase().name(),
                laufendesSpiel.geber(),
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
                fachlichesSpiel.vorbehalte().stream().map(VorbehaltMeldungAntwort::aus).toList(),
                tisch.partie().bockrundenZaehlerAusDb(),
                hochzeitGeklaert,
                fachlichesSpiel.schweinchenAktiv(),
                fachlichesSpiel.schweinchenGemeldetVon().orElse(null),
                fachlichesSpiel.armutStatus().map(ArmutStatus::armutSpieler).orElse(null)
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

        private static Map<SpielerPosition, SpielerEntity> spielerNachPosition(TischEntity tisch) {
            EnumMap<SpielerPosition, SpielerEntity> spielerNachPosition = new EnumMap<>(SpielerPosition.class);
            List<SpielerEntity> spieler = tisch.spieler();
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

        private static Hand handVon(Spiel laufendesSpiel, SpielerPosition position) {
            return laufendesSpiel.haende().get(position);
        }
    }

    @Schema(description = "Darstellung eines Spielers im laufenden Spiel.")
    public record SpielerImSpielAntwort(
        @Schema(description = "Sitzposition des Spielers.")
        SpielerPosition position,
        @Schema(description = "Eindeutige Spieler-ID.", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        UUID spielerId,
        @Schema(description = "Interner Name des Spielers.", example = "Karlchen")
        String name,
        @Schema(description = "Oeffentlicher Anzeigename.", example = "Karlchen")
        String anzeigeName,
        @Schema(description = "Avatar-Farbe als Hex-String.", example = "#FF5733")
        String avatarFarbe,
        @Schema(description = "Ob es sich um einen KI-Spieler handelt.")
        boolean istKi,
        @Schema(description = "Ob dieser menschliche Spieler nach Verbindungsabbruch von der KI gesteuert wird.")
        boolean istKiUebernommen,
        @Schema(description = "Ob dieser Spieler der anfragende Spieler selbst ist.")
        boolean istSelbst,
        @Schema(description = "Ob dieser Spieler der aktuelle Geber ist.")
        boolean istGeber,
        @Schema(description = "Ob dieser Spieler gerade am Zug ist.")
        boolean istAmZug,
        @Schema(description = "Anzahl verbleibender Handkarten.", example = "10")
        Integer verbleibendeKarten,
        @Schema(description = "Anzahl gewonnener Stiche in diesem Spiel.", example = "2")
        int gewonneneStiche,
        @Schema(description = "Partei des Spielers, falls sichtbar.")
        Partei partei,
        @Schema(description = "Sichtbare Handkarten; null fuer Gegner.")
        List<KarteAntwort> sichtbareHandkarten
    ) {

        static SpielerImSpielAntwort aus(
            SpielerPosition position,
            SpielerEntity spielerEntity,
            Hand hand,
            SpielerPosition sichtbarePosition,
            SpielerPosition aktuellerSpieler,
            SpielerPosition geberPosition,
            boolean zeigeAlleHaende,
            int gewonneneStiche,
            Partei partei
        ) {
            List<KarteAntwort> sichtbareHandkarten = hand != null && (zeigeAlleHaende || position == sichtbarePosition)
                ? hand.karten().stream()
                    .map(KarteAntwort::aus)
                    .toList()
                : null;
            return new SpielerImSpielAntwort(
                position,
                spielerEntity == null ? null : spielerEntity.id(),
                spielerEntity == null ? "Unbesetzt" : spielerEntity.name(),
                spielerEntity == null ? "Unbesetzt" : spielerEntity.anzeigeName(),
                spielerEntity == null ? null : spielerEntity.avatarFarbe(),
                spielerEntity != null && spielerEntity.istKi(),
                spielerEntity != null && spielerEntity.istKiUebernommen(),
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

    @Schema(description = "Darstellung einer einzelnen Spielkarte.")
    public record KarteAntwort(
        @Schema(description = "Eindeutige Karten-ID.", example = "HERZ-DAME-0")
        String id,
        @Schema(description = "Farbe der Karte.", example = "HERZ")
        String farbe,
        @Schema(description = "Wert der Karte.", example = "DAME")
        String wert,
        @Schema(description = "Exemplar-Index (0 oder 1 im Doppelkopf-Deck).", example = "0")
        int exemplarIndex
    ) {

        static KarteAntwort aus(Karte karte) {
            return new KarteAntwort(
                "%s-%s-%d".formatted(karte.farbe().name(), karte.wert().name(), karte.exemplarIndex()),
                karte.farbe().name(),
                karte.wert().name(),
                karte.exemplarIndex()
            );
        }
    }

    @Schema(description = "Eine in den Stich gespielte Karte mit Spielerposition und Reihenfolge.")
    public record GespielteKarteAntwort(
        @Schema(description = "Position des Spielers, der die Karte gespielt hat.")
        SpielerPosition spielerPosition,
        @Schema(description = "Die gespielte Karte.")
        KarteAntwort karte,
        @Schema(description = "Reihenfolge innerhalb des Stichs.", example = "1")
        int reihenfolge
    ) {

        static GespielteKarteAntwort aus(de.locodoko.partie.GespielteKarte gespielteKarte) {
            return new GespielteKarteAntwort(
                gespielteKarte.spieler(),
                KarteAntwort.aus(gespielteKarte.karte()),
                gespielteKarte.reihenfolge()
            );
        }
    }

    @Schema(description = "Einzelnes Ansage-Ereignis in der Ansage-Historie.")
    public record AnsageEreignisAntwort(
        @Schema(description = "Position des ansagenden Spielers.")
        SpielerPosition spielerPosition,
        @Schema(description = "Die getaetigte Ansage.")
        Ansage ansage
    ) {

        static AnsageEreignisAntwort aus(AnsageEreignis ereignis) {
            return new AnsageEreignisAntwort(ereignis.spieler(), ereignis.ansage());
        }
    }

    @Schema(description = "Ein abgeschlossener Stich mit allen gespielten Karten und Ergebnis.")
    public record AbgeschlossenerStichAntwort(
        @Schema(description = "Nummer des Spiels in der Partie.", example = "1")
        int spielNummer,
        @Schema(description = "Nummer des Stichs im Spiel.", example = "3")
        int stichNummer,
        @Schema(description = "Position des aufspielenden Spielers.")
        SpielerPosition aufspielerPosition,
        @Schema(description = "Position des Stichgewinners.")
        SpielerPosition gewinnerPosition,
        @Schema(description = "Augenwert des Stichs.", example = "32")
        int augen,
        @Schema(description = "Alle im Stich gespielten Karten.")
        List<GespielteKarteAntwort> gespielteKarten
    ) {

        static List<AbgeschlossenerStichAntwort> aus(Spiel spiel) {
            if (spiel == null) {
                return List.of();
            }
            List<Stich> stiche = spiel.abgeschlosseneStiche();
            List<AbgeschlossenerStichAntwort> ergebnis = new ArrayList<>();
            for (int i = 0; i < stiche.size(); i++) {
                Stich stich = stiche.get(i);
                ergebnis.add(new AbgeschlossenerStichAntwort(
                    spiel.spielNummer(),
                    i + 1,
                    stich.aufspieler(),
                    stich.gewinner(spiel.trumpfOrdnung()).spieler(),
                    stich.augen().wert(),
                    stich.gespielteKarten().stream().map(GespielteKarteAntwort::aus).toList()
                ));
            }
            return List.copyOf(ergebnis);
        }
    }

    @Schema(description = "Sonderpunkt-Ereignis (z.B. Fuchs gefangen, Karlchen).")
    public record SonderpunktEreignisDto(
        @Schema(description = "Art des Sonderpunkts.")
        Sonderpunkt art,
        @Schema(description = "Position des Spielers, der den Sonderpunkt erzielt hat.")
        SpielerPosition taeter,
        @Schema(description = "Position des betroffenen Gegenspielers.")
        SpielerPosition opfer
    ) {}

    @Schema(description = "Ergebnis des letzten abgeschlossenen Spiels in der Partie.")
    public record LetztesSpielergebnisAntwort(
        @Schema(description = "Nummer des abgeschlossenen Spiels.", example = "2")
        int spielNummer,
        @Schema(description = "Typ des Spiels.")
        Spieltyp spieltyp,
        @Schema(description = "Siegerpartei des Spiels.")
        Partei siegerPartei,
        @Schema(description = "Gesamter Spielwert inklusive aller Modifikatoren.", example = "4")
        int spielwert,
        @Schema(description = "Grundwert des Spiels vor Modifikatoren.", example = "2")
        int grundwert,
        @Schema(description = "Zusatzpunkte durch Absagen.", example = "1")
        int absagePunkte,
        @Schema(description = "Punkte fuer Sieg gegen die Alten.", example = "1")
        int gegenDieAltenPunkte,
        @Schema(description = "Multiplikator fuer Solo-Spiele.", example = "1")
        int soloMultiplikator,
        @Schema(description = "Augen pro Partei (Re/Kontra).")
        Map<Partei, Integer> augenProPartei,
        @Schema(description = "Spielpunkte pro Spielerposition.")
        Map<SpielerPosition, Integer> spielpunkteProSpieler,
        @Schema(description = "Sonderpunkte pro Partei.")
        Map<Partei, List<SonderpunktEreignisDto>> sonderpunkteProPartei,
        @Schema(description = "Aufschluesselung des Spielwerts nach Komponenten (Point Provenance).")
        List<PunkteKomponenteAntwort> punkteAufschluesselung
    ) {

        static LetztesSpielergebnisAntwort aus(Spiel spiel) {
            if (spiel == null || spiel.ergebnis().isEmpty()) {
                return null;
            }

            Spielergebnis ergebnis = spiel.ergebnis().get();
            EnumMap<Partei, Integer> augenProPartei = new EnumMap<>(Partei.class);
            augenProPartei.put(Partei.RE, ergebnis.augenVon(Partei.RE).wert());
            augenProPartei.put(Partei.KONTRA, ergebnis.augenVon(Partei.KONTRA).wert());

            EnumMap<SpielerPosition, Integer> spielpunkteProSpieler = new EnumMap<>(SpielerPosition.class);
            spielpunkteProSpieler.put(SpielerPosition.SUED, ergebnis.spielpunkteVon(SpielerPosition.SUED).wert());
            spielpunkteProSpieler.put(SpielerPosition.WEST, ergebnis.spielpunkteVon(SpielerPosition.WEST).wert());
            spielpunkteProSpieler.put(SpielerPosition.NORD, ergebnis.spielpunkteVon(SpielerPosition.NORD).wert());
            spielpunkteProSpieler.put(SpielerPosition.OST, ergebnis.spielpunkteVon(SpielerPosition.OST).wert());

            EnumMap<Partei, List<SonderpunktEreignisDto>> sonderpunkteProPartei = new EnumMap<>(Partei.class);
            for (Partei partei : Partei.values()) {
                sonderpunkteProPartei.put(
                    partei,
                    ergebnis.sonderpunkteVon(partei).stream()
                        .map(sp -> new SonderpunktEreignisDto(sp.art(), sp.taeter(), sp.opfer()))
                        .toList()
                );
            }

            int grundwert = ergebnis.grundwert();
            int absagePunkte = ergebnis.absagePunkte();
            int gegenDieAltenPunkte = ergebnis.gegenDieAltenPunkte();
            int spielwert = ergebnis.spielwert().wert();

            List<PunkteKomponenteAntwort> aufschluesselung = new ArrayList<>();
            aufschluesselung.add(new PunkteKomponenteAntwort("GRUNDWERT", "Grundwert", grundwert));
            if (absagePunkte != 0) aufschluesselung.add(new PunkteKomponenteAntwort("ABSAGE", "Absagen", absagePunkte));
            if (gegenDieAltenPunkte != 0) aufschluesselung.add(new PunkteKomponenteAntwort("GEGEN_DIE_ALTEN", "Gegen die Alten", gegenDieAltenPunkte));
            int sonderpunkteWert = spielwert - grundwert - absagePunkte - gegenDieAltenPunkte;
            if (sonderpunkteWert != 0) aufschluesselung.add(new PunkteKomponenteAntwort("SONDERPUNKTE", "Sonderpunkte", sonderpunkteWert));

            return new LetztesSpielergebnisAntwort(
                spiel.spielNummer(),
                spiel.spieltyp(),
                ergebnis.siegerPartei(),
                spielwert,
                grundwert,
                absagePunkte,
                gegenDieAltenPunkte,
                ergebnis.soloMultiplikator(),
                Map.copyOf(augenProPartei),
                Map.copyOf(spielpunkteProSpieler),
                Map.copyOf(sonderpunkteProPartei),
                List.copyOf(aufschluesselung)
            );
        }
    }

    @Schema(description = "Einzelne Komponente des Spielwerts (Point Provenance).")
    public record PunkteKomponenteAntwort(
        @Schema(description = "Typ der Komponente (z.B. GRUNDWERT, ABSAGE, SONDERPUNKTE).", example = "GRUNDWERT")
        String typ,
        @Schema(description = "Deutsches Label der Komponente fuer die Anzeige.", example = "Grundwert")
        String label,
        @Schema(description = "Punkte dieser Komponente.", example = "2")
        int punkte
    ) {}

    public record VorbehaltMeldungAntwort(
        @Schema(description = "Position des Spielers, der den Vorbehalt gemeldet hat.")
        SpielerPosition position,
        @Schema(description = "Der gemeldete Vorbehalt (z.B. GESUND, SOLO_TRUMPF, HOCHZEIT).")
        VorbehaltAnsage ansage
    ) {
        static VorbehaltMeldungAntwort aus(VorbehaltMeldung meldung) {
            return new VorbehaltMeldungAntwort(meldung.spielerPosition(), meldung.ansage());
        }
    }
}
