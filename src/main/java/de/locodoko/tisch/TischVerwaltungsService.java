package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerZugriffVerweigertException;
import de.locodoko.tisch.persistenz.PartieRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TischVerwaltungsService {

    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final TischEchtzeitService tischEchtzeitService;
    private final TischZugriff tischZugriff;
    private final PartieCountdownService partieCountdownService;

    public TischVerwaltungsService(
        TischRepository tischRepository,
        PartieRepository partieRepository,
        TischEchtzeitService tischEchtzeitService,
        TischZugriff tischZugriff,
        PartieCountdownService partieCountdownService
    ) {
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.tischEchtzeitService = tischEchtzeitService;
        this.tischZugriff = tischZugriff;
        this.partieCountdownService = partieCountdownService;
    }

    @Transactional(readOnly = true)
    public List<TischListenEintragAntwort> listeOffeneTische() {
        return tischRepository.findAllByStatusOrderByErstelltAmAsc(TischStatus.WARTEND)
            .stream()
            .filter(tisch -> tisch.zugangsmodus() == Zugangsmodus.OFFEN)
            .map(TischListenEintragAntwort::aus)
            .toList();
    }

    @Transactional
    public TischAntwort erstelleTisch(SpielerEntity spieler, TischErstellenAnfrage anfrage) {
        SpielerEntity verwalteterSpieler = tischZugriff.ladeSpieler(SpielerId.von(spieler.id()));
        pruefeDassSpielerAnKeinemTischSitzt(verwalteterSpieler);

        TischkonfigurationEmbeddable konfiguration;
        if (anfrage.presetName() != null) {
            konfiguration = mapPresetToKonfiguration(anfrage.presetName());
        } else {
            konfiguration = anfrage.konfiguration() == null
                ? TischkonfigurationEmbeddable.standard()
                : anfrage.konfiguration().alsEmbeddable();
        }

        if (anfrage.anzahlSpiele() != null) {
            konfiguration.setzteAnzahlSpiele(anfrage.anzahlSpiele());
        }

        Zugangsmodus zugangsmodus = Boolean.TRUE.equals(anfrage.privat())
            ? Zugangsmodus.PRIVAT
            : Zugangsmodus.OFFEN;
        TischEntity tisch = TischEntity.neu(anfrage.name(), verwalteterSpieler, konfiguration, zugangsmodus);
        tisch.fuegeSpielerHinzu(verwalteterSpieler);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.aktualisiert(TischEreignisTyp.TISCH_ERSTELLT, antwort)
        );
        return antwort;
    }

    private TischkonfigurationEmbeddable mapPresetToKonfiguration(String presetName) {
        return switch (presetName) {
            case "LOCO_BLATT" -> TischkonfigurationEmbeddable.locoBlatRegeln();
            case "DKV_TURNIER" -> TischkonfigurationEmbeddable.dkvRegeln();
            default -> throw new SpielverwaltungKonfliktException(
                "UNGUELTIGES_PRESET",
                "Das gewaehlte Regel-Preset '" + presetName + "' existiert nicht."
            );
        };
    }

    @Transactional
    public TischAntwort betreteTisch(TischId tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = tischZugriff.ladeSpieler(SpielerId.von(spieler.id()));
        pruefeDassSpielerAnKeinemTischSitzt(verwalteterSpieler);
        TischEntity tisch = tischZugriff.ladeTischEntityMitSperre(tischId);
        tischZugriff.pruefeWartendenTisch(tisch, "TISCH_BEREITS_GESTARTET", "Ein gestarteter Tisch kann nicht mehr betreten werden.");
        if (tisch.zugangsmodus() == Zugangsmodus.PRIVAT && verwalteterSpieler.istGast()) {
            throw new SpielerZugriffVerweigertException(
                "Private Tische koennen nur von eingeloggten Spielern betreten werden."
            );
        }
        if (tisch.istVoll()) {
            throw new SpielverwaltungKonfliktException("TISCH_VOLL", "Der Tisch ist bereits voll belegt.");
        }
        tisch.fuegeSpielerHinzu(verwalteterSpieler);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.aktualisiert(TischEreignisTyp.SPIELER_BEIGETRETEN, antwort)
        );
        return antwort;
    }

    @Transactional
    public BestaetigungAntwort verlasseTisch(TischId tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = tischZugriff.ladeSpieler(SpielerId.von(spieler.id()));
        TischEntity tisch = tischZugriff.ladeTischEntityMitSperre(tischId);

        if (!tisch.enthaeltSpieler(verwalteterSpieler)) {
            throw new SpielverwaltungKonfliktException(
                "SPIELER_NICHT_AM_TISCH",
                "Der Spieler sitzt nicht an diesem Tisch."
            );
        }

        if (tisch.status() == TischStatus.IM_SPIEL) {
            return brichAktivePartieAb(tisch);
        }

        tisch.entferneSpieler(verwalteterSpieler);
        if (tisch.spieler().isEmpty()) {
            UUID geloeschterTischId = tisch.id();
            partieCountdownService.brecheCountdownAb(geloeschterTischId);
            tischRepository.delete(tisch);
            tischRepository.flush();
            tischEchtzeitService.planeTischliste(TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()));
            tischEchtzeitService.planeTischEreignis(TischEreignisAntwort.tischEntfernt(geloeschterTischId));
            return new BestaetigungAntwort("Tisch erfolgreich verlassen. Der leere Tisch wurde entfernt.");
        }
        if (tisch.erstelltVon().id().equals(verwalteterSpieler.id())) {
            tisch.setzeErstelltVon(tisch.spieler().getFirst());
        }
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.aktualisiert(TischEreignisTyp.SPIELER_VERLASSEN, TischAntwort.aus(gespeicherterTisch))
        );
        return new BestaetigungAntwort("Tisch erfolgreich verlassen.");
    }

    /**
     * Entfernt einen Spieler vom Tisch (Kick). Nur der Gastgeber darf kicken.
     * Nicht moeglich waehrend einer laufenden Partie.
     */
    @Transactional
    public BestaetigungAntwort kickeSpieler(TischId tischId, SpielerId zielSpielerId, SpielerEntity gastgeber) {
        SpielerEntity verwalteterGastgeber = tischZugriff.ladeSpieler(SpielerId.von(gastgeber.id()));
        TischEntity tisch = tischZugriff.ladeTischEntityMitSperre(tischId);

        if (!tisch.erstelltVon().id().equals(verwalteterGastgeber.id())) {
            throw new SpielverwaltungKonfliktException(
                "KICK_NICHT_ERLAUBT",
                "Nur der Gastgeber darf Spieler vom Tisch entfernen."
            );
        }
        if (zielSpielerId.wert().equals(verwalteterGastgeber.id())) {
            throw new SpielverwaltungKonfliktException(
                "KICK_NICHT_ERLAUBT",
                "Der Gastgeber kann sich nicht selbst kicken."
            );
        }
        tischZugriff.pruefeWartendenTisch(tisch, "KICK_IM_SPIEL", "Spieler koennen waehrend einer laufenden Partie nicht gekickt werden.");

        SpielerEntity zielSpieler = tisch.spieler().stream()
            .filter(s -> zielSpielerId.wert().equals(s.id()))
            .findFirst()
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "SPIELER_NICHT_AM_TISCH",
                "Der Spieler sitzt nicht an diesem Tisch."
            ));
        tisch.entferneSpieler(zielSpieler);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.aktualisiert(TischEreignisTyp.SPIELER_GEKICKT, antwort)
        );
        return new BestaetigungAntwort("Spieler wurde vom Tisch entfernt.");
    }

    /**
     * <p>Die Partie wird als {@code ABGEBROCHEN} persistiert, alle Spieler am Tisch erhalten
     * ein {@code PARTIE_ABGEBROCHEN}-WebSocket-Event und werden dadurch zur Lobby zurueckgeleitet.
     * Danach wird der Tisch geloescht.</p>
     */
    private BestaetigungAntwort brichAktivePartieAb(TischEntity tisch) {
        UUID tischId = tisch.id();
        if (tisch.partie() != null) {
            tisch.partie().markiereAlsAbgebrochen();
            partieRepository.saveAndFlush(tisch.partie());
        }
        partieCountdownService.brecheCountdownAb(tischId);
        tischRepository.delete(tisch);
        tischRepository.flush();
        tischEchtzeitService.planeTischliste(TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()));
        tischEchtzeitService.planeTischEreignis(TischEreignisAntwort.partieAbgebrochen(tischId));
        return new BestaetigungAntwort("Partie abgebrochen. Alle Spieler wurden zur Lobby zurueckgeleitet.");
    }

    @Transactional(readOnly = true)
    public TischAntwort ladeTisch(TischId tischId) {
        return TischAntwort.aus(tischZugriff.ladeTischEntity(tischId));
    }

    /**
     * Tritt einem Tisch ueber seinen Einladungscode bei.
     * Delegiert an {@link #betreteTisch} nachdem der Tisch via Code aufgeloest wurde.
     */
    @Transactional
    public TischAntwort beitretenViaCode(String einladungsCode, SpielerEntity spieler) {
        TischEntity tisch = tischRepository.findByEinladungsCode(einladungsCode.toUpperCase())
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "EINLADUNGSCODE_UNGUELTIG",
                "Es wurde kein Tisch mit dem Einladungscode '" + einladungsCode + "' gefunden."
            ));
        return betreteTisch(TischId.von(tisch.id()), spieler);
    }

    private void veroeffentlicheTischAktualisierung(
        TischlisteEreignisAntwort tischlisteEreignis,
        TischEreignisAntwort tischEreignis
    ) {
        tischEchtzeitService.planeTischliste(tischlisteEreignis);
        tischEchtzeitService.planeTischEreignis(tischEreignis);
    }

    private void pruefeDassSpielerAnKeinemTischSitzt(SpielerEntity spieler) {
        tischRepository.findBySpieler_Id(SpielerId.von(spieler.id())).ifPresent(tisch -> {
            throw new SpielverwaltungKonfliktException(
                "SPIELER_BEREITS_AN_TISCH",
                "Ein Spieler darf gleichzeitig nur an einem Tisch sitzen."
            );
        });
    }
}
