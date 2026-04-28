package de.locodoko.tisch;

import de.locodoko.partie.Partie;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielergebnis;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Verwaltet den Lebenszyklus einer Partie: Spiel abschliessen und naechstes starten.
 *
 * <p>Diese Logik ist unabhaengig von der Anwesenheit von KI-Spielern und kann
 * fuer reine Mehrspieler-Partien (nur Menschen) ebenso eingesetzt werden wie
 * fuer KI-Tische. Kapselt die Zustandsuebertragung aus dem Domain-Modell in
 * die persistierte Partie sowie den Versand der zugehoerigen WebSocket-Ereignisse.</p>
 */
@Service
public class PartieLifecycleService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PartieLifecycleService.class);

    private final TischEchtzeitService tischEchtzeitService;
    private final SpielerRepository spielerRepository;
    private final PartieCountdownService partieCountdownService;

    public PartieLifecycleService(TischEchtzeitService tischEchtzeitService, SpielerRepository spielerRepository, PartieCountdownService partieCountdownService) {
        this.tischEchtzeitService = tischEchtzeitService;
        this.spielerRepository = spielerRepository;
        this.partieCountdownService = partieCountdownService;
    }

    /**
     * Uebertraegt das Ergebnis von {@link Partie#schliesseAktuellesSpielAbUndStarteNaechstes()}
     * in die persistierte Partie und versendet die entsprechenden WebSocket-Ereignisse.
     *
     * <p>Reihenfolge der Ereignisse ist intentional:
     * 1. SPIEL_BEENDET mit Ergebnis des abgeschlossenen Spiels (noch ohne naechste Karten).
     * 2. Naechstes Spiel wird an die Partie angehaengt.
     * Falls die Partie beendet ist, wird kein Folge-Spiel gestartet.</p>
     */
    public void uebernehmeDomainPartieAbschluss(TischEntity tisch, Spiel abgeschlossenesSpiel, Partie neuePartie) {
        Partie partie = tisch.partie();
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            partie.setzeGesamtpunktestand(position, neuePartie.gesamtpunktestand().get(position));
        }
        partie.setzeBockrundenZaehlerDb(neuePartie.bockrundenZaehler());
        partie.setzeSolistDesLetztenSpielsDb(neuePartie.solistDesLetztenSpiels().orElse(null));
        abgeschlossenesSpiel.uebernehmeDomainStand(neuePartie.abgeschlosseneSpiele().getLast());
        if (neuePartie.istBeendet()) {
            partie.markiereAlsBeendet();
            veroeffentlicheSpielBeendet(tisch, abgeschlossenesSpiel);
            partieCountdownService.starteCountdown(tisch.id());
            return;
        }

        // SPIEL_BEENDET senden, bevor das neue Spiel an die Liste gehaengt wird —
        // damit der Snapshot im Event nur das Ergebnis des alten Spiels zeigt,
        // nicht schon die neuen Karten des Folgespiels.
        veroeffentlicheSpielBeendet(tisch, abgeschlossenesSpiel);

        tisch.spieler().stream()
            .filter(s -> !s.istKi() && s.istKiUebernommen())
            .forEach(s -> {
                s.hebeKiUebernahmeAuf();
                spielerRepository.save(s);
            });
        Spiel neuesSpiel = neuePartie.aktuellesSpiel();
        neuesSpiel.setzeSpielNummer(partie.aktuellesSpielNummer() + 1);
        partie.fuegeSpielHinzu(neuesSpiel);
        LOGGER.info("Naechstes Spiel gestartet [tischId={}, spielNr={}]", tisch.id(), neuesSpiel.spielNummer());
    }

    /**
     * Sendet das SPIEL_GESTARTET-Ereignis an alle menschlichen Spieler am Tisch.
     */
    public void veroeffentlicheSpielGestartet(TischEntity tisch) {
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.spielGestartet(PartieStandAntwort.aus(tisch, s.id()))
            ));
    }

    /**
     * Liefert eine Zuordnung von Spielerposition zu SpielerEntity fuer den gegebenen Tisch.
     */
    public static Map<SpielerPosition, SpielerEntity> spielerNachPosition(TischEntity tisch) {
        EnumMap<SpielerPosition, SpielerEntity> result = new EnumMap<>(SpielerPosition.class);
        List<SpielerEntity> spieler = tisch.spieler();
        List<SpielerPosition> positionen = SpielerPosition.standardReihenfolge();
        for (int index = 0; index < spieler.size() && index < positionen.size(); index++) {
            result.put(positionen.get(index), spieler.get(index));
        }
        return Map.copyOf(result);
    }

    private void veroeffentlicheSpielBeendet(TischEntity tisch, Spiel abgeschlossenesSpiel) {
        Spielergebnis ergebnis = abgeschlossenesSpiel.ergebnis().orElse(null);
        if (ergebnis == null) return;
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> tischEchtzeitService.planeAnBenutzer(
                s.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.spielBeendet(PartieStandAntwort.aus(tisch, s.id()))
            ));
    }
}
