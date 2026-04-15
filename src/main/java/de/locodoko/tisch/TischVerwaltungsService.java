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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TischVerwaltungsService {

    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final SpielerRepository spielerRepository;
    private final KiSpielerFabrik kiSpielerFabrik;
    private final KiOrchestrierungService kiOrchestrierungService;
    private final TischEchtzeitService tischEchtzeitService;
    private final SpielRegistry spielRegistry;

    public TischVerwaltungsService(
        TischRepository tischRepository,
        PartieRepository partieRepository,
        SpielerRepository spielerRepository,
        KiSpielerFabrik kiSpielerFabrik,
        KiOrchestrierungService kiOrchestrierungService,
        TischEchtzeitService tischEchtzeitService,
        SpielRegistry spielRegistry
    ) {
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.spielerRepository = spielerRepository;
        this.kiSpielerFabrik = kiSpielerFabrik;
        this.kiOrchestrierungService = kiOrchestrierungService;
        this.tischEchtzeitService = tischEchtzeitService;
        this.spielRegistry = spielRegistry;
    }

    @Transactional(readOnly = true)
    public List<TischListenEintragAntwort> listeOffeneTische() {
        return tischRepository.findAllByStatusOrderByErstelltAmAsc(TischStatus.WARTEND)
            .stream()
            .map(TischListenEintragAntwort::aus)
            .toList();
    }

    @Transactional
    public TischAntwort erstelleTisch(SpielerEntity spieler, TischErstellenAnfrage anfrage) {
        SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
        pruefeDassSpielerAnKeinemTischSitzt(verwalteterSpieler);
        TischkonfigurationEmbeddable konfiguration = anfrage.konfiguration() == null
            ? TischkonfigurationEmbeddable.standard()
            : anfrage.konfiguration().alsEmbeddable();
        TischEntity tisch = TischEntity.neu(anfrage.name(), verwalteterSpieler, konfiguration);
        tisch.fuegeSpielerHinzu(verwalteterSpieler);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.aktualisiert(TischEreignisTyp.TISCH_ERSTELLT, antwort)
        );
        return antwort;
    }

    @Transactional
    public TischAntwort betreteTisch(TischId tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
        pruefeDassSpielerAnKeinemTischSitzt(verwalteterSpieler);
        TischEntity tisch = ladeTischEntityMitSperre(tischId);
        pruefeWartendenTisch(tisch, "TISCH_BEREITS_GESTARTET", "Ein gestarteter Tisch kann nicht mehr betreten werden.");
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
        SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
        TischEntity tisch = ladeTischEntityMitSperre(tischId);

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
     * Bricht eine laufende Partie ab, weil ein Spieler den Tisch willentlich verlassen hat.
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
        spielRegistry.entferne(TischId.von(tischId));
        tischRepository.delete(tisch);
        tischRepository.flush();
        tischEchtzeitService.planeTischliste(TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()));
        tischEchtzeitService.planeTischEreignis(TischEreignisAntwort.partieAbgebrochen(tischId));
        return new BestaetigungAntwort("Partie abgebrochen. Alle Spieler wurden zur Lobby zurueckgeleitet.");
    }

    @Transactional
    public TischAntwort starteTisch(TischId tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
        TischEntity tisch = ladeTischEntityMitSperre(tischId);
        pruefeWartendenTisch(tisch, "TISCH_BEREITS_GESTARTET", "Der Tisch wurde bereits gestartet.");
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
        Partie partie = Partie.neuePersistenz(tisch.konfiguration().anzahlSpiele());
        partie.fuegeSpielHinzu(erzeugeErstesSpiel(tisch));
        tisch.setzePartie(partie);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        kiOrchestrierungService.automatisiereTisch(gespeicherterTisch);
        gespeicherterTisch = tischRepository.saveAndFlush(gespeicherterTisch);
        synchronisiereRegistry(tischId, gespeicherterTisch);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        PartieStandAntwort partieStand = PartieStandAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.spielGestartet(antwort, partieStand)
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
        ladeSpieler(SpielerId.von(spieler.id())); // Session validieren
        TischEntity tisch = ladeTischEntityMitSperre(tischId);
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
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && s.istKiUebernommen())
            .forEach(s -> {
                s.hebeKiUebernahmeAuf();
                spielerRepository.save(s);
            });
        Partie neuePartie = Partie.neuePersistenz(tisch.konfiguration().anzahlSpiele());
        neuePartie.fuegeSpielHinzu(erzeugeErstesSpiel(tisch));
        tisch.setzePartie(neuePartie);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        kiOrchestrierungService.automatisiereTisch(gespeicherterTisch);
        gespeicherterTisch = tischRepository.saveAndFlush(gespeicherterTisch);
        synchronisiereRegistry(tischId, gespeicherterTisch);
        TischAntwort tischAntwort = TischAntwort.aus(gespeicherterTisch);
        PartieStandAntwort partieStand = PartieStandAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.spielGestartet(tischAntwort, partieStand)
        );
        veroeffentlichePartieAktualisierung(gespeicherterTisch);
        return new BestaetigungAntwort("Neue Partie gestartet.");
    }

    @Transactional(readOnly = true)
    public TischKonfigurationDto ladeKonfiguration(TischId tischId) {
        return TischKonfigurationDto.aus(ladeTischEntity(tischId).konfiguration());
    }

    @Transactional
    public TischKonfigurationDto aktualisiereKonfiguration(
        TischId tischId,
        SpielerEntity spieler,
        TischKonfigurationDto konfiguration
    ) {
        SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
        TischEntity tisch = ladeTischEntityMitSperre(tischId);
        pruefeWartendenTisch(
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
        SpielerEntity verwalteterSpieler = ladeSpieler(SpielerId.von(spieler.id()));
        pruefeDassSpielerAnKeinemTischSitzt(verwalteterSpieler);

        TischEntity tisch = sucheOffenenTisch()
            .map(offenerTisch -> {
                TischEntity gesperrt = ladeTischEntityMitSperre(TischId.von(offenerTisch.id()));
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
        Partie partie = Partie.neuePersistenz(tisch.konfiguration().anzahlSpiele());
        partie.fuegeSpielHinzu(erzeugeErstesSpiel(tisch));
        tisch.setzePartie(partie);
        TischEntity gespeicherterTisch = tischRepository.saveAndFlush(tisch);
        kiOrchestrierungService.automatisiereTisch(gespeicherterTisch);
        gespeicherterTisch = tischRepository.saveAndFlush(gespeicherterTisch);
        synchronisiereRegistry(TischId.von(gespeicherterTisch.id()), gespeicherterTisch);
        TischAntwort antwort = TischAntwort.aus(gespeicherterTisch);
        PartieStandAntwort partieStand = PartieStandAntwort.aus(gespeicherterTisch);
        veroeffentlicheTischAktualisierung(
            TischlisteEreignisAntwort.aktualisiert(listeOffeneTische()),
            TischEreignisAntwort.spielGestartet(antwort, partieStand)
        );
        veroeffentlichePartieAktualisierung(gespeicherterTisch);
        return antwort;
    }

    /**
     * Sucht den aeltesten offenen Tisch mit mindestens einem freien Platz.
     */
    private Optional<TischEntity> sucheOffenenTisch() {
        return tischRepository.findAllByStatusOrderByErstelltAmAsc(TischStatus.WARTEND)
            .stream()
            .filter(tisch -> !tisch.istVoll())
            .findFirst();
    }

    @Transactional(readOnly = true)
    public TischAntwort ladeTisch(TischId tischId) {
        return TischAntwort.aus(ladeTischEntity(tischId));
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

    private void synchronisiereRegistry(TischId tischId, TischEntity tisch) {
        if (tisch.partie() == null) {
            spielRegistry.entferne(tischId);
            return;
        }
        tisch.partie().spiele().stream()
            .filter(s -> s.ergebnisEmbeddable() == null)
            .reduce((a, b) -> b)
            .ifPresentOrElse(
                s -> { s.hydriere(tisch.konfiguration().alsSpielregeln()); spielRegistry.registriere(tischId, s); },
                () -> spielRegistry.entferne(tischId)
            );
    }

    private void veroeffentlicheTischAktualisierung(
        TischlisteEreignisAntwort tischlisteEreignis,
        TischEreignisAntwort tischEreignis
    ) {
        tischEchtzeitService.planeTischliste(tischlisteEreignis);
        tischEchtzeitService.planeTischEreignis(tischEreignis);
    }

    private void veroeffentlichePartieAktualisierung(TischEntity tisch) {
        PartieStandAntwort broadcastStand = PartieStandAntwort.aus(tisch);
        tischEchtzeitService.planePartieEreignis(PartieEreignisAntwort.aktualisiert(PartieEreignisTyp.PARTIE_AKTUALISIERT, broadcastStand));
        tisch.spieler().stream()
            .filter(spieler -> !spieler.istKi() && spieler.sessionId() != null)
            .forEach(spieler -> tischEchtzeitService.planeAnBenutzer(
                spieler.sessionId(),
                "/queue/partie/" + tisch.partie().id(),
                PartieEreignisAntwort.snapshot(PartieStandAntwort.aus(tisch, spieler.id()))
            ));
    }

    TischEntity ladeTischEntity(TischId tischId) {
        return tischRepository.findById(tischId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "TISCH_NICHT_GEFUNDEN",
                "Es wurde kein Tisch mit der ID " + tischId + " gefunden."
            ));
    }

    /**
     * Laedt einen Tisch mit exklusiver Datenbanksperre (PESSIMISTIC_WRITE).
     * Muss fuer alle schreibenden Operationen verwendet werden, die zuerst den
     * Tischzustand pruefen (z.B. istVoll, Status WARTEND) und dann mutieren —
     * sonst koennen zwei gleichzeitige Requests beide die Pruefung bestehen und
     * den Tisch in einen inkonsistenten Zustand bringen.
     */
    private TischEntity ladeTischEntityMitSperre(TischId tischId) {
        return tischRepository.findByIdWithLock(tischId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "TISCH_NICHT_GEFUNDEN",
                "Es wurde kein Tisch mit der ID " + tischId + " gefunden."
            ));
    }

    private SpielerEntity ladeSpieler(SpielerId spielerId) {
        return spielerRepository.findById(spielerId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "SPIELER_NICHT_GEFUNDEN",
                "Es wurde kein Spieler mit der ID " + spielerId + " gefunden."
            ));
    }

    private void pruefeDassSpielerAnKeinemTischSitzt(SpielerEntity spieler) {
        tischRepository.findBySpieler_Id(SpielerId.von(spieler.id())).ifPresent(tisch -> {
            throw new SpielverwaltungKonfliktException(
                "SPIELER_BEREITS_AN_TISCH",
                "Ein Spieler darf gleichzeitig nur an einem Tisch sitzen."
            );
        });
    }

    private void pruefeWartendenTisch(TischEntity tisch, String fehlerCode, String nachricht) {
        if (tisch.status() != TischStatus.WARTEND) {
            throw new SpielverwaltungKonfliktException(fehlerCode, nachricht);
        }
    }

    private Spiel erzeugeErstesSpiel(TischEntity tisch) {
        Kartendeck kartendeck = Kartendeck.neu(tisch.konfiguration().alsSpielregeln()).gemischt();
        Spiel spiel = Spiel.neu(SpielerPosition.SUED, tisch.konfiguration().alsSpielregeln(), kartendeck).teileKartenAus();
        spiel.setzeSpielNummer(1);
        return spiel;
    }
}
