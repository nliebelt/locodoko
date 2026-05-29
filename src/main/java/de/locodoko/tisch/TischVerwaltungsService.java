package de.locodoko.tisch;

import de.locodoko.karten.Kartendeck;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Partie;
import de.locodoko.tisch.persistenz.PartieRepository;
import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.Spiel;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerRepository;
import de.locodoko.spieler.SpielerZugriffVerweigertException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import de.locodoko.tisch.KiSpielerFabrik;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TischVerwaltungsService {

    private static final Logger LOGGER = LoggerFactory.getLogger(TischVerwaltungsService.class);

    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final SpielerRepository spielerRepository;
    private final KiSpielerFabrik kiSpielerFabrik;
    private final ApplicationEventPublisher eventPublisher;
    private final TischEchtzeitService tischEchtzeitService;
    private final TischZugriff tischZugriff;

    public TischVerwaltungsService(
        TischRepository tischRepository,
        PartieRepository partieRepository,
        SpielerRepository spielerRepository,
        KiSpielerFabrik kiSpielerFabrik,
        ApplicationEventPublisher eventPublisher,
        TischEchtzeitService tischEchtzeitService,
        TischZugriff tischZugriff
    ) {
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.spielerRepository = spielerRepository;
        this.kiSpielerFabrik = kiSpielerFabrik;
        this.eventPublisher = eventPublisher;
        this.tischEchtzeitService = tischEchtzeitService;
        this.tischZugriff = tischZugriff;
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

    public List<TischPresetAntwort> gibPresets() {
        return List.of(
            new TischPresetAntwort(
                "LOCO_BLATT",
                "Loco-Blatt (Hausregeln)",
                "Alle Sonderregeln aktiv, ohne Neunen (40 Karten). Ideal fuer schnelle, dynamische Runden.",
                TischKonfigurationDto.aus(TischkonfigurationEmbeddable.locoBlatRegeln())
            ),
            new TischPresetAntwort(
                "DKV_TURNIER",
                "DKV-Turnier",
                "Offizielle Turnierregeln des Deutschen Doppelkopf-Verbandes. Ohne Sonderpunkte, mit Neunen (48 Karten).",
                TischKonfigurationDto.aus(TischkonfigurationEmbeddable.dkvRegeln())
            )
        );
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
            return brichAktivePartieAb(tisch, verwalteterSpieler);
        }

        tisch.entferneSpieler(verwalteterSpieler);
        if (tisch.spieler().isEmpty()) {
            UUID geloeschterTischId = tisch.id();
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
     *
     * <p>Die Partie wird als {@code ABGEBROCHEN} persistiert, alle Spieler am Tisch erhalten
     * ein {@code PARTIE_ABGEBROCHEN}-WebSocket-Event und werden dadurch zur Lobby zurueckgeleitet.
     * Danach wird der Tisch geloescht.</p>
     */
    private BestaetigungAntwort brichAktivePartieAb(TischEntity tisch, SpielerEntity verlassenderSpieler) {
        UUID tischId = tisch.id();
        if (tisch.partie() != null) {
            tisch.partie().markiereAlsAbgebrochen();
            partieRepository.saveAndFlush(tisch.partie());
        }
        tischRepository.delete(tisch);
        tischRepository.flush();
        tischEchtzeitService.planeTischliste(TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()));
        tischEchtzeitService.planeTischEreignis(TischEreignisAntwort.partieAbgebrochen(tischId));
        return new BestaetigungAntwort("Partie abgebrochen. Alle Spieler wurden zur Lobby zurueckgeleitet.");
    }

    @Transactional
    public TischAntwort starteTisch(TischId tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = tischZugriff.ladeSpieler(SpielerId.von(spieler.id()));
        TischEntity tisch = tischZugriff.ladeTischEntityMitSperre(tischId);
        tischZugriff.pruefeWartendenTisch(tisch, "TISCH_BEREITS_GESTARTET", "Der Tisch wurde bereits gestartet.");
        if (!tisch.erstelltVon().id().equals(verwalteterSpieler.id())) {
            throw new SpielverwaltungKonfliktException(
                "TISCH_START_NICHT_ERLAUBT",
                "Nur der Tischersteller darf das Spiel starten."
            );
        }
        if (tisch.spieler().stream().noneMatch(spielerEntity -> !spielerEntity.istKi())) {
            throw new SpielverwaltungKonfliktException(
                "TISCH_START_NICHT_ERLAUBT",
                "Zum Starten muss mindestens ein menschlicher Spieler am Tisch sitzen."
            );
        }
        while (!tisch.istVoll()) {
            tisch.fuegeSpielerHinzu(kiSpielerFabrik.erzeugeNaechstenSpieler());
        }
        Partie partie = Partie.neuePersistenz(tisch.konfiguration().anzahlSpiele(), tisch.konfiguration().alsSpielregeln());
        partie.fuegeSpielHinzu(erzeugeErstesSpiel(tisch));
        Partie gespeichertePartie = partieRepository.saveAndFlush(partie);
        tisch.setzePartie(gespeichertePartie);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        gespeicherterTisch.setzePartieTransient(gespeichertePartie);
        eventPublisher.publishEvent(new KiUebernahmeEreignis(TischId.von(gespeicherterTisch.id())));
        gespeicherterTisch = tischRepository.saveAndFlush(gespeicherterTisch);
        gespeicherterTisch.setzePartieTransient(gespeichertePartie);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.spielGestartet(antwort, PartieStandAntwort.aus(gespeicherterTisch))
        );
        veroeffentlichePartieAktualisierung(gespeicherterTisch);
        return antwort;
    }

    /**
     * Startet eine neue Partie an einem laufenden Tisch, nachdem die vorherige Partie beendet wurde.
     *
     * <p>Idempotent: Wenn die aktuelle Partie noch laeuft, wird die Anfrage ignoriert.
     * Nur zulassig wenn TischStatus IM_SPIEL und PartieStatus BEENDET.
     * Die neuen Partie-Events werden an alle Spieler am Tisch gesendet.</p>
     */
    @Transactional
    public BestaetigungAntwort starteNeuePartie(TischId tischId, SpielerEntity spieler) {
        tischZugriff.ladeSpieler(SpielerId.von(spieler.id())); // Session validieren
        TischEntity tisch = tischZugriff.ladeTischEntityMitSperre(tischId);
        if (tisch.status() != TischStatus.IM_SPIEL) {
            throw new SpielverwaltungKonfliktException(
                "TISCH_NICHT_IM_SPIEL",
                "Neue Partie kann nur an einem laufenden Tisch gestartet werden."
            );
        }
        if (tisch.partie() != null && tisch.partie().statusAusDb() == PartieStatus.LAUFEND) {
            return new BestaetigungAntwort("Partie laeuft bereits.");
        }
        if (tisch.partie() == null || tisch.partie().statusAusDb() != PartieStatus.BEENDET) {
            throw new SpielverwaltungKonfliktException(
                "PARTIE_NICHT_BEENDET",
                "Neue Partie kann nur nach vollstaendigem Abschluss der aktuellen Partie gestartet werden."
            );
        }
        starteNaechstePartieIntern(tisch);
        return new BestaetigungAntwort("Neue Partie gestartet.");
    }

    /**
     * Startet automatisch eine neue Partie nach Ablauf des Countdowns.
     * Keine Session-Validierung — wird serverseitig vom {@link PartieCountdownService} aufgerufen.
     *
     * @param tischId ID des Tisches, an dem eine neue Partie gestartet werden soll
     */
    @Transactional
    public void starteNeuePartieAutomat(TischId tischId) {
        TischEntity tisch = tischZugriff.ladeTischEntityMitSperre(tischId);
        if (tisch.status() != TischStatus.IM_SPIEL) {
            LOGGER.warn("Auto-Start abgebrochen: Tisch nicht IM_SPIEL [tischId={}]", tischId);
            return;
        }
        if (tisch.partie() != null && tisch.partie().statusAusDb() == PartieStatus.LAUFEND) {
            // Manuell bereits gestartet — kein Auto-Start noetig
            return;
        }
        if (tisch.partie() == null || tisch.partie().statusAusDb() != PartieStatus.BEENDET) {
            LOGGER.warn("Auto-Start abgebrochen: Partie nicht BEENDET [tischId={}]", tischId);
            return;
        }
        starteNaechstePartieIntern(tisch);
    }

    private void starteNaechstePartieIntern(TischEntity tisch) {
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && s.istKiUebernommen())
            .forEach(s -> {
                s.hebeKiUebernahmeAuf();
                spielerRepository.save(s);
            });
        Partie neuePartie = Partie.neuePersistenz(tisch.konfiguration().anzahlSpiele(), tisch.konfiguration().alsSpielregeln());
        neuePartie.fuegeSpielHinzu(erzeugeErstesSpiel(tisch));
        Partie gespeichertePartie = partieRepository.saveAndFlush(neuePartie);
        tisch.setzePartie(gespeichertePartie);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        gespeicherterTisch.setzePartieTransient(gespeichertePartie);
        eventPublisher.publishEvent(new KiUebernahmeEreignis(TischId.von(gespeicherterTisch.id())));
        gespeicherterTisch = tischRepository.saveAndFlush(gespeicherterTisch);
        gespeicherterTisch.setzePartieTransient(gespeichertePartie);
        TischAntwort tischAntwort = TischAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.spielGestartet(tischAntwort, PartieStandAntwort.aus(gespeicherterTisch))
        );
        veroeffentlichePartieAktualisierung(gespeicherterTisch);
    }

    @Transactional(readOnly = true)
    public TischKonfigurationDto ladeKonfiguration(TischId tischId) {
        return TischKonfigurationDto.aus(tischZugriff.ladeTischEntity(tischId).konfiguration());
    }

    @Transactional
    public TischKonfigurationDto aktualisiereKonfiguration(
        TischId tischId,
        SpielerEntity spieler,
        TischKonfigurationDto konfiguration
    ) {
        SpielerEntity verwalteterSpieler = tischZugriff.ladeSpieler(SpielerId.von(spieler.id()));
        TischEntity tisch = tischZugriff.ladeTischEntityMitSperre(tischId);
        tischZugriff.pruefeWartendenTisch(
            tisch,
            "TISCH_KONFIGURATION_GESPERRT",
            "Die Tischkonfiguration darf nach Spielbeginn nicht mehr geaendert werden."
        );
        if (!tisch.erstelltVon().id().equals(verwalteterSpieler.id())) {
            throw new SpielverwaltungKonfliktException(
                "TISCH_KONFIGURATION_NICHT_ERLAUBT",
                "Nur der Tischersteller darf die Konfiguration aendern."
            );
        }
        tisch.aktualisiereKonfiguration(konfiguration.alsEmbeddable());
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.aktualisiert(
                TischEreignisTyp.TISCH_KONFIGURATION_AKTUALISIERT,
                TischAntwort.aus(gespeicherterTisch)
            )
        );
        return TischKonfigurationDto.aus(gespeicherterTisch.konfiguration());
    }

    /**
     * Schnellstart: Sucht einen offenen Tisch mit freiem Platz. Falls vorhanden, tritt der Spieler
     * bei. Andernfalls wird ein neuer Tisch erstellt. In beiden Faellen wird der Tisch anschliessend
     * mit KI-Spielern aufgefuellt und die Partie sofort gestartet.
     */
    @Transactional
    public TischAntwort schnellEinsteigen(SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = tischZugriff.ladeSpieler(SpielerId.von(spieler.id()));
        pruefeDassSpielerAnKeinemTischSitzt(verwalteterSpieler);

        TischEntity tisch = sucheOffenenTisch()
            .map(offenerTisch -> {
                TischEntity gesperrt = tischZugriff.ladeTischEntityMitSperre(TischId.von(offenerTisch.id()));
                if (gesperrt.istVoll() || gesperrt.status() != TischStatus.WARTEND) {
                    return null;
                }
                gesperrt.fuegeSpielerHinzu(verwalteterSpieler);
                return tischRepository.saveAndFlush(gesperrt);
            })
            .orElse(null);

        if (tisch == null) {
            String spielerName = verwalteterSpieler.name() != null ? verwalteterSpieler.name() : "Spieler";
            tisch = TischEntity.neu("Schnellstart von " + spielerName, verwalteterSpieler, TischkonfigurationEmbeddable.standard());
            tisch.fuegeSpielerHinzu(verwalteterSpieler);
            tisch = tischRepository.saveAndFlush(tisch);
        }

        while (!tisch.istVoll()) {
            tisch.fuegeSpielerHinzu(kiSpielerFabrik.erzeugeNaechstenSpieler());
        }
        Partie partie = Partie.neuePersistenz(tisch.konfiguration().anzahlSpiele(), tisch.konfiguration().alsSpielregeln());
        partie.fuegeSpielHinzu(erzeugeErstesSpiel(tisch));
        Partie gespeichertePartie = partieRepository.saveAndFlush(partie);
        tisch.setzePartie(gespeichertePartie);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        gespeicherterTisch.setzePartieTransient(gespeichertePartie);
        eventPublisher.publishEvent(new KiUebernahmeEreignis(TischId.von(gespeicherterTisch.id())));
        gespeicherterTisch = tischRepository.saveAndFlush(gespeicherterTisch);
        gespeicherterTisch.setzePartieTransient(gespeichertePartie);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.spielGestartet(antwort, PartieStandAntwort.aus(gespeicherterTisch))
        );
        veroeffentlichePartieAktualisierung(gespeicherterTisch);
        return antwort;
    }

    /**
     * Sucht den aeltesten offenen (nicht privaten) Tisch mit mindestens einem freien Platz.
     */
    private Optional<TischEntity> sucheOffenenTisch() {
        return tischRepository.findAllByStatusOrderByErstelltAmAsc(TischStatus.WARTEND)
            .stream()
            .filter(tisch -> tisch.zugangsmodus() == Zugangsmodus.OFFEN)
            .filter(tisch -> !tisch.istVoll())
            .findFirst();
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

    private void veroeffentlichePartieAktualisierung(TischEntity tisch) {
        if (tisch.partie() == null) return;
        tisch.spieler().stream()
            .filter(spieler -> !spieler.istKi() && !spieler.istKiUebernommen() && spieler.sessionId() != null)
            .forEach(spieler -> {
                PartieStandAntwort stand = PartieStandAntwort.aus(tisch, spieler.id());
                tischEchtzeitService.planeAnBenutzer(
                    spieler.sessionId(),
                    "/queue/partie/" + tisch.partie().id(),
                    new PartieEreignisBatch(stand.version(), List.of(PartieEreignisAntwort.snapshot(stand)))
                );
            });
    }

    private void pruefeDassSpielerAnKeinemTischSitzt(SpielerEntity spieler) {
        tischRepository.findBySpieler_Id(SpielerId.von(spieler.id())).ifPresent(tisch -> {
            throw new SpielverwaltungKonfliktException(
                "SPIELER_BEREITS_AN_TISCH",
                "Ein Spieler darf gleichzeitig nur an einem Tisch sitzen."
            );
        });
    }

    private Spiel erzeugeErstesSpiel(TischEntity tisch) {
        Kartendeck kartendeck = Kartendeck.neu(tisch.konfiguration().alsSpielregeln()).gemischt();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, tisch.konfiguration().alsSpielregeln(), kartendeck);
        spiel.teileKartenAus();
        spiel.setzeSpielNummer(1);
        return spiel;
    }
}
