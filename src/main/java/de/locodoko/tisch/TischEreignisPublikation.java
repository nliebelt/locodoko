package de.locodoko.tisch;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
class TischEreignisPublikation {

    private final TischEchtzeitService tischEchtzeitService;

    TischEreignisPublikation(TischEchtzeitService tischEchtzeitService) {
        this.tischEchtzeitService = tischEchtzeitService;
    }

    void veroeffentlicheAnsageEreignisse(TischEntity tisch) {
        if (tisch.partie() == null) {
            return;
        }
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> {
                PartieStandAntwort stand = PartieStandAntwort.aus(tisch, s.id());
                tischEchtzeitService.planeAnBenutzer(
                    s.sessionId(),
                    "/queue/partie/" + tisch.partie().id(),
                    new PartieEreignisBatch(stand.version(), List.of(PartieEreignisAntwort.ansageErfolgt(stand)))
                );
            });
    }

    void veroeffentlicheEinwurfEreignisse(TischEntity tisch) {
        if (tisch.partie() == null) {
            return;
        }
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
            .forEach(s -> {
                PartieStandAntwort stand = PartieStandAntwort.aus(tisch, s.id());
                tischEchtzeitService.planeAnBenutzer(
                    s.sessionId(),
                    "/queue/partie/" + tisch.partie().id(),
                    new PartieEreignisBatch(stand.version(), List.of(PartieEreignisAntwort.spielGestartet(stand)))
                );
            });
    }
}
