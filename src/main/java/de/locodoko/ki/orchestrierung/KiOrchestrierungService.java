package de.locodoko.ki.orchestrierung;

import de.locodoko.ki.KiArmutAntwort;
import de.locodoko.ki.KiSchwierigkeit;
import de.locodoko.ki.KiSpielzustand;
import de.locodoko.ki.KiStrategie;
import de.locodoko.ki.KiStrategieFactory;
import de.locodoko.karten.Karte;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielEreignis;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.VorbehaltAnsage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Fuehrt einen einzelnen KI-Zug aus.
 *
 * <p>Entscheidet anhand der aktuellen Spielphase und KI-Strategie den naechsten Zug:
 * Vorbehalt melden, Armut anbieten/annehmen/ablehnen oder eine Karte spielen (ggf. mit Ansage).
 * Gibt das Ergebnis als {@link KiAktionErgebnis} zurueck — ohne Persistenz oder WebSocket-Logik.
 * Der {@code KiTischOrchestrator} im Tisch-Kontext ist verantwortlich fuer die
 * Orchestrierung des Loop, Speichern und Broadcasten.</p>
 */
@Service
public class KiOrchestrierungService {

    private static final Logger LOGGER = LoggerFactory.getLogger(KiOrchestrierungService.class);

    private final KiStrategieFactory kiStrategieFactory;

    public KiOrchestrierungService(KiStrategieFactory kiStrategieFactory) {
        this.kiStrategieFactory = kiStrategieFactory;
    }

    /**
     * Fuehrt einen KI-Zug fuer den angegebenen Spieler aus.
     *
     * @param laufendesSpiel  aktueller Spielstand
     * @param spielerPosition die KI-Spielerposition
     * @param schwierigkeit   Schwierigkeitsstufe der KI
     * @return Ergebnis des Zugs mit aktualisiertem Spielstand und Ereignissen
     */
    public KiAktionErgebnis fuehreAktionAus(Spiel laufendesSpiel, SpielerPosition spielerPosition, KiSchwierigkeit schwierigkeit) {
        KiStrategie strategie = kiStrategieFactory.erzeuge(schwierigkeit);
        return switch (laufendesSpiel.phase()) {
            case Spielphase.VorbehaltAnsage _ -> {
                VorbehaltAnsage vorbehalt = strategie.waehleVorbehalt(KiSpielzustand.aus(laufendesSpiel, spielerPosition));
                LOGGER.info("KI meldet Vorbehalt [spielerId={}, vorbehalt={}]", spielerPosition, vorbehalt);
                laufendesSpiel.meldeVorbehalt(spielerPosition, vorbehalt);
                if (laufendesSpiel.phase() instanceof Spielphase.VorbehaltAufloesung) {
                    laufendesSpiel.loeseVorbehalteAuf();
                }
                yield new KiAktionErgebnis(laufendesSpiel, null, List.of());
            }
            case Spielphase.ArmutTausch _ -> {
                KiSpielzustand zustand = KiSpielzustand.aus(laufendesSpiel, spielerPosition);
                if (laufendesSpiel.armutStatus().filter(status -> status.armutSpieler() == spielerPosition && !status.angebotLiegtVor()).isPresent()) {
                    laufendesSpiel.legeArmutTrumpfkarten(spielerPosition, strategie.waehleArmutAngebot(zustand));
                } else {
                    KiArmutAntwort armutAntwort = strategie.waehleArmutAntwort(zustand);
                    if (armutAntwort.angenommen()) {
                        laufendesSpiel.nimmArmutAn(spielerPosition, armutAntwort.rueckgabekarten());
                    } else {
                        laufendesSpiel.lehneArmutAb(spielerPosition);
                    }
                }
                yield new KiAktionErgebnis(laufendesSpiel, null, List.of());
            }
            case Spielphase.Stichphase _ -> {
                KiSpielzustand zustand = KiSpielzustand.aus(laufendesSpiel, spielerPosition);
                if (!laufendesSpiel.pflichtansageAusstehend().isEmpty()) {
                    Partei eigenePartei = laufendesSpiel.parteien().parteiVon(spielerPosition);
                    if (laufendesSpiel.pflichtansageAusstehend().contains(eigenePartei)) {
                        Ansage pflichtansage = eigenePartei == Partei.RE ? Ansage.RE : Ansage.KONTRA;
                        LOGGER.info("KI meldet Pflichtansage [spielerId={}, ansage={}]", spielerPosition, pflichtansage);
                        laufendesSpiel.sageAn(spielerPosition, pflichtansage);
                        yield new KiAktionErgebnis(laufendesSpiel, null, List.of());
                    }
                }
                Ansage ansage = strategie.waehleAnsage(zustand).orElse(null);
                if (ansage != null) {
                    LOGGER.info("KI meldet Ansage [spielerId={}, ansage={}]", spielerPosition, ansage);
                    laufendesSpiel.sageAn(spielerPosition, ansage);
                    yield new KiAktionErgebnis(laufendesSpiel, null, List.of());
                }
                Karte karte = strategie.waehleKarte(zustand);
                LOGGER.debug("KI spielt Karte [karte={}, spielerId={}]", karte, spielerPosition);
                List<SpielEreignis> ereignisse = laufendesSpiel.spieleKarte(spielerPosition, karte);
                yield new KiAktionErgebnis(laufendesSpiel, karte.karteId(), ereignisse);
            }
            default -> new KiAktionErgebnis(laufendesSpiel, null, List.of());
        };
    }
}
