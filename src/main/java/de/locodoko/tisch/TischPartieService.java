package de.locodoko.tisch;

import de.locodoko.karten.Kartendeck;
import de.locodoko.partie.Partie;
import de.locodoko.partie.PartieStatus;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import de.locodoko.spieler.SpielerRepository;
import de.locodoko.tisch.persistenz.PartieRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TischPartieService {

    private static final Logger LOGGER = LoggerFactory.getLogger(TischPartieService.class);

    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final SpielerRepository spielerRepository;
    private final KiSpielerFabrik kiSpielerFabrik;
    private final ApplicationEventPublisher eventPublisher;
    private final TischEchtzeitService tischEchtzeitService;
    private final TischZugriff tischZugriff;

    public TischPartieService(
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
        Partie partie = Partie.neuePersistenz(tisch.konfiguration().anzahlSpiele(), tisch.konfiguration().alsSpielregeln(), verwalteterSpieler.id());
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
        starteNaechstePartieIntern(tisch, spieler.id());
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
        starteNaechstePartieIntern(tisch, null);
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
        Partie partie = Partie.neuePersistenz(tisch.konfiguration().anzahlSpiele(), tisch.konfiguration().alsSpielregeln(), verwalteterSpieler.id());
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

    private void starteNaechstePartieIntern(TischEntity tisch, UUID erstelltVon) {
        tisch.spieler().stream()
            .filter(s -> !s.istKi() && s.istKiUebernommen())
            .forEach(s -> {
                s.hebeKiUebernahmeAuf();
                spielerRepository.save(s);
            });
        Partie neuePartie = Partie.neuePersistenz(tisch.konfiguration().anzahlSpiele(), tisch.konfiguration().alsSpielregeln(), erstelltVon);
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

    private List<TischListenEintragAntwort> listeOffeneTische() {
        return tischRepository.findAllByStatusOrderByErstelltAmAsc(TischStatus.WARTEND)
            .stream()
            .filter(tisch -> tisch.zugangsmodus() == Zugangsmodus.OFFEN)
            .map(TischListenEintragAntwort::aus)
            .toList();
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
