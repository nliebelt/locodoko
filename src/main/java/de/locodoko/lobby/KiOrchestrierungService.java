package de.locodoko.lobby;

import de.locodoko.partie.ki.KiArmutAntwort;
import de.locodoko.partie.ki.KiSpielzustand;
import de.locodoko.partie.ki.KiStrategie;
import de.locodoko.partie.ki.KiStrategieFactory;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Karte;
import de.locodoko.karten.SpielerPosition;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partei;
import de.locodoko.partie.PunkteRechner;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.partie.VorbehaltAnsage;
import de.locodoko.partie.PartieEntity;
import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.SpielEntity;
import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerRepository;
import de.locodoko.lobby.TischEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * Orchestriert KI-Zuege nach jeder menschlichen oder KI-Aktion.
 *
 * <p>Haengt in {@link TischService} nach Tischstart und nach jeder spielrelevanten Aktion
 * (Vorbehalt, Armut, Karte, Ansage). Gibt solange KI-Zuege aus, bis ein menschlicher Spieler
 * am Zug ist oder das Spiel endet. Wertet abgeschlossene Spiele aus, startet Folge-Spiele
 * innerhalb der Partie und markiert beendete Partien. Bei KI-Strategie-Exceptions wird
 * die Aktion geloggt und abgebrochen, ohne die Datenbank in einem inkonsistenten Zustand
 * zu hinterlassen.</p>
 */
@Service
public class KiOrchestrierungService {

    // Logger fuer Fehler und Sicherheitslimit-Warnungen
    private static final Logger LOGGER = LoggerFactory.getLogger(KiOrchestrierungService.class);

    private static final int MAXIMALE_KI_AKTIONEN = 512;

    private final KiStrategieFactory kiStrategieFactory;
    private final SpielerRepository spielerRepository;
    private final PunkteRechner punkteRechner = new PunkteRechner();

    public KiOrchestrierungService(KiStrategieFactory kiStrategieFactory, SpielerRepository spielerRepository) {
        this.kiStrategieFactory = kiStrategieFactory;
        this.spielerRepository = spielerRepository;
    }

    public void automatisiereTisch(TischEntity tisch) {
        Objects.requireNonNull(tisch, "tisch darf nicht null sein");
        if (tisch.partie() == null || tisch.partie().status() == PartieStatus.BEENDET) {
            return;
        }
        SpielEntity startSpiel = findeLaufendesSpiel(tisch.partie());
        Spielphase startPhase = startSpiel != null ? startSpiel.phase() : null;
        LOGGER.info("KI-Orchestrierung gestartet [tischId={}, spielphase={}]", tisch.id(), startPhase);
        int anzahlAktionen = 0;
        while (anzahlAktionen++ < MAXIMALE_KI_AKTIONEN) {
            if (tisch.partie().status() == PartieStatus.BEENDET) {
                return;
            }
            SpielEntity laufendesSpielEntity = findeLaufendesSpiel(tisch.partie());
            if (laufendesSpielEntity == null) {
                return;
            }
            Spiel laufendesSpiel = SpielPersistenzAdapter.zuDomainSpiel(laufendesSpielEntity);
            if (laufendesSpiel.phase() == Spielphase.AUSWERTUNG) {
                LOGGER.info("Spiel beendet [spielNr={}, tischId={}]", laufendesSpielEntity.spielNummer(), tisch.id());
                SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, laufendesSpiel.werteAus(punkteRechner));
                continue;
            }
            if (laufendesSpiel.phase() == Spielphase.GESAMTSTAND_AKTUALISIEREN) {
                schliesseSpielAbUndStarteNaechstes(tisch, laufendesSpielEntity, laufendesSpiel);
                continue;
            }
            SpielerPosition erwarteterSpieler = laufendesSpiel.erwarteterSpieler().orElse(null);
            if (erwarteterSpieler == null) {
                return;
            }
            SpielerEntity spielerEntity = spielerNachPosition(tisch).get(erwarteterSpieler);
            // Normale KI-Spieler oder menschliche Spieler, deren Steuerung nach einem
            // Verbindungsabbruch an die KI übergeben wurde, werden weiter orchestriert
            if (spielerEntity == null || (!spielerEntity.istKi() && !spielerEntity.istKiUebernommen())) {
                return;
            }
            LOGGER.info("KI-Spielzug [spielerId={}, phase={}]", erwarteterSpieler, laufendesSpiel.phase());
            // KI-Strategie-Exceptions abfangen: Die Partie bleibt im letzten konsistenten
            // Datenbankstand, weil uebernehmeDomainSpiel erst nach dem KI-Aufruf aufgerufen wird.
            // Ohne diesen Schutz haengt die Partie permanent, weil jeder folgende Aufruf
            // dieselbe Exception erzeugen wuerde.
            try {
                KiStrategie strategie = kiStrategieFactory.erzeuge(tisch.konfiguration().kiSchwierigkeit());
                Spiel naechsterStand = fuehreKiAktionAus(laufendesSpiel, erwarteterSpieler, strategie);
                SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, naechsterStand);
            } catch (Exception e) {
                LOGGER.error(
                    "KI-Strategie-Fehler fuer Spieler {} in Phase {} an Tisch {} – Partie bleibt im letzten konsistenten Stand: {}",
                    erwarteterSpieler, laufendesSpiel.phase(), tisch.id(), e.getMessage(), e
                );
                return;
            }
        }
        LOGGER.error("KI-Orchestrierung hat das Sicherheitslimit von {} Aktionen an Tisch {} erreicht – moegliche Endlosschleife.",
            MAXIMALE_KI_AKTIONEN, tisch.id());
        throw new IllegalStateException("Die KI-Orchestrierung hat das Sicherheitslimit erreicht.");
    }

    private Spiel fuehreKiAktionAus(Spiel laufendesSpiel, SpielerPosition spielerPosition, KiStrategie strategie) {
        KiSpielzustand zustand = KiSpielzustand.aus(laufendesSpiel, spielerPosition);
        return switch (laufendesSpiel.phase()) {
            case VORBEHALT_ANSAGE -> {
                VorbehaltAnsage vorbehalt = strategie.waehleVorbehalt(zustand);
                Spiel spielNachVorbehalt = laufendesSpiel.meldeVorbehalt(spielerPosition, vorbehalt);
                yield spielNachVorbehalt.phase() == Spielphase.VORBEHALT_AUFLOESUNG
                    ? spielNachVorbehalt.loeseVorbehalteAuf()
                    : spielNachVorbehalt;
            }
            case ARMUT_TAUSCH -> {
                if (laufendesSpiel.armutStatus().filter(status -> status.armutSpieler() == spielerPosition && !status.angebotLiegtVor()).isPresent()) {
                    yield laufendesSpiel.legeArmutTrumpfkarten(spielerPosition, strategie.waehleArmutAngebot(zustand));
                }
                KiArmutAntwort armutAntwort = strategie.waehleArmutAntwort(zustand);
                yield armutAntwort.angenommen()
                    ? laufendesSpiel.nimmArmutAn(spielerPosition, armutAntwort.rueckgabekarten())
                    : laufendesSpiel.lehneArmutAb(spielerPosition);
            }
            case STICHPHASE -> {
                Ansage ansage = strategie.waehleAnsage(zustand).orElse(null);
                if (ansage != null) {
                    yield laufendesSpiel.sageAn(spielerPosition, ansage);
                }
                Karte karte = strategie.waehleKarte(zustand);
                LOGGER.debug("KI spielt Karte [karte={}, spielerId={}]", karte, spielerPosition);
                yield laufendesSpiel.spieleKarte(spielerPosition, karte);
            }
            default -> laufendesSpiel;
        };
    }

    private void schliesseSpielAbUndStarteNaechstes(TischEntity tisch, SpielEntity laufendesSpielEntity, Spiel laufendesSpiel) {
        SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, laufendesSpiel);
        Spielergebnis spielergebnis = laufendesSpiel.ergebnis()
            .orElseThrow(() -> new IllegalStateException("Ein abgeschlossenes Spiel braucht ein Ergebnis"));
        PartieEntity partie = tisch.partie();
        boolean bockrundenAktiv = tisch.konfiguration().bockrundenAktiv();

        // Bockrunden: Neue Trigger erkennen
        int neueTrigger = 0;
        if (bockrundenAktiv) {
            if (laufendesSpiel.hatHerzDurchgegangenenStich()) {
                neueTrigger++;
            }
            if (spielergebnis.siegerPartei() == Partei.RE
                    && laufendesSpiel.ansagen().hatGrundansage(Partei.KONTRA, laufendesSpiel.parteien())) {
                neueTrigger++;
            }
        }

        // Spielpunkte mit optionalem Bockrunden-Multiplikator akkumulieren
        int multiplikator = (bockrundenAktiv && partie.bockrundenZaehler() > 0) ? 2 : 1;
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            int neuerWert = partie.gesamtpunktestand().getOrDefault(position, 0)
                + spielergebnis.spielpunkteVon(position) * multiplikator;
            partie.setzeGesamtpunktestand(position, neuerWert);
        }

        // Bockrunden-Zaehler aktualisieren
        int neuerBockrundenZaehler = (partie.bockrundenZaehler() > 0 ? partie.bockrundenZaehler() - 1 : 0) + neueTrigger;
        partie.setzeBockrundenZaehler(neuerBockrundenZaehler);
        // Solo-Nachgeben: Solist und Geber fuer naechstes Spiel bestimmen
        boolean warSolo = laufendesSpiel.parteien() != null
            && laufendesSpiel.parteien().spielerVon(Partei.RE).size() == 1;
        SpielerPosition naechsterGeber = warSolo
            ? laufendesSpiel.geber()
            : laufendesSpiel.geber().naechsteImUhrzeigersinn();
        SpielerPosition solist = warSolo ? laufendesSpiel.parteien().spielerVon(Partei.RE).get(0) : null;
        partie.setzeSolistDesLetztenSpiels(null); // alten Solist-Eintrag loeschen
        long abgeschlosseneSpiele = partie.spiele().stream().filter(spiel -> spiel.ergebnis() != null).count();
        if (abgeschlosseneSpiele >= partie.anzahlSpiele()) {
            partie.markiereAlsBeendet();
            return;
        }
        // Beim Start eines neuen Spiels: KI-Übernahme für alle Spieler aufheben,
        // damit reconnectete Spieler wieder selbst spielen können
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && s.istKiUebernommen())
            .forEach(s -> {
                s.hebeKiUebernahmeAuf();
                spielerRepository.save(s);
            });
        Spiel neuesSpiel = solist != null
            ? Spiel.neuMitSolistAufspieler(naechsterGeber, solist, tisch.konfiguration().alsSpielregeln(),
                Kartendeck.neu(tisch.konfiguration().alsSpielregeln()).gemischt()).teileKartenAus()
            : Spiel.neu(naechsterGeber, tisch.konfiguration().alsSpielregeln(),
                Kartendeck.neu(tisch.konfiguration().alsSpielregeln()).gemischt()).teileKartenAus();
        SpielEntity neuesSpielEntity = SpielEntity.neu(
            partie.aktuellesSpielNummer() + 1,
            neuesSpiel.geber(),
            neuesSpiel.spieltyp(),
            neuesSpiel.phase()
        );
        SpielPersistenzAdapter.uebernehmeDomainSpiel(neuesSpielEntity, neuesSpiel);
        partie.fuegeSpielHinzu(neuesSpielEntity);
        LOGGER.info("Neue Partie gestartet [tischId={}, spielNr={}]", tisch.id(), neuesSpielEntity.spielNummer());
    }

    private SpielEntity findeLaufendesSpiel(PartieEntity partie) {
        return partie.spiele().stream()
            .reduce((erstes, zweites) -> zweites)
            .orElse(null);
    }

    private Map<SpielerPosition, SpielerEntity> spielerNachPosition(TischEntity tisch) {
        EnumMap<SpielerPosition, SpielerEntity> spielerNachPosition = new EnumMap<>(SpielerPosition.class);
        for (int index = 0; index < tisch.spieler().size() && index < SpielerPosition.standardReihenfolge().size(); index++) {
            spielerNachPosition.put(SpielerPosition.standardReihenfolge().get(index), tisch.spieler().get(index));
        }
        return Map.copyOf(spielerNachPosition);
    }
}
