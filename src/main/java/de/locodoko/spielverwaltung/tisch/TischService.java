package de.locodoko.spielverwaltung.tisch;

import de.locodoko.spielverwaltung.persistenz.PartieEntity;
import de.locodoko.spielverwaltung.persistenz.PartieRepository;
import de.locodoko.spielverwaltung.persistenz.SpielerEntity;
import de.locodoko.spielverwaltung.persistenz.SpielerRepository;
import de.locodoko.spielverwaltung.persistenz.TischEntity;
import de.locodoko.spielverwaltung.persistenz.TischRepository;
import de.locodoko.spielverwaltung.persistenz.TischStatus;
import de.locodoko.spielverwaltung.persistenz.TischkonfigurationEmbeddable;
import de.locodoko.spielverwaltung.session.KiSpielerFabrik;
import de.locodoko.spielverwaltung.session.SpielverwaltungKonfliktException;
import de.locodoko.spielverwaltung.session.SpielverwaltungNichtGefundenException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TischService {

    private final TischRepository tischRepository;
    private final PartieRepository partieRepository;
    private final SpielerRepository spielerRepository;
    private final KiSpielerFabrik kiSpielerFabrik;

    public TischService(
        TischRepository tischRepository,
        PartieRepository partieRepository,
        SpielerRepository spielerRepository,
        KiSpielerFabrik kiSpielerFabrik
    ) {
        this.tischRepository = tischRepository;
        this.partieRepository = partieRepository;
        this.spielerRepository = spielerRepository;
        this.kiSpielerFabrik = kiSpielerFabrik;
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
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        pruefeDassSpielerAnKeinemTischSitzt(verwalteterSpieler);
        TischkonfigurationEmbeddable konfiguration = anfrage.konfiguration() == null
            ? TischkonfigurationEmbeddable.standard()
            : anfrage.konfiguration().alsEmbeddable();
        TischEntity tisch = TischEntity.neu(anfrage.name(), verwalteterSpieler, konfiguration);
        tisch.fuegeSpielerHinzu(verwalteterSpieler);
        return TischAntwort.aus(tischRepository.saveAndFlush(tisch));
    }

    @Transactional
    public TischAntwort betreteTisch(UUID tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        pruefeDassSpielerAnKeinemTischSitzt(verwalteterSpieler);
        TischEntity tisch = ladeTisch(tischId);
        pruefeWartendenTisch(tisch, "TISCH_BEREITS_GESTARTET", "Ein gestarteter Tisch kann nicht mehr betreten werden.");
        if (tisch.istVoll()) {
            throw new SpielverwaltungKonfliktException("TISCH_VOLL", "Der Tisch ist bereits voll belegt.");
        }
        tisch.fuegeSpielerHinzu(verwalteterSpieler);
        return TischAntwort.aus(tischRepository.saveAndFlush(tisch));
    }

    @Transactional
    public BestaetigungAntwort verlasseTisch(UUID tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        TischEntity tisch = ladeTisch(tischId);
        pruefeWartendenTisch(
            tisch,
            "TISCH_VERLASSEN_NICHT_ERLAUBT",
            "Ein Tisch kann nach Spielbeginn nicht mehr ueber die Lobby verlassen werden."
        );
        if (!tisch.enthaeltSpieler(verwalteterSpieler)) {
            throw new SpielverwaltungKonfliktException(
                "SPIELER_NICHT_AM_TISCH",
                "Der Spieler sitzt nicht an diesem Tisch."
            );
        }
        tisch.entferneSpieler(verwalteterSpieler);
        if (tisch.spieler().isEmpty()) {
            tischRepository.delete(tisch);
            tischRepository.flush();
            return new BestaetigungAntwort("Tisch erfolgreich verlassen. Der leere Tisch wurde entfernt.");
        }
        if (tisch.erstelltVon().id().equals(verwalteterSpieler.id())) {
            tisch.setzeErstelltVon(tisch.spieler().getFirst());
        }
        tischRepository.saveAndFlush(tisch);
        return new BestaetigungAntwort("Tisch erfolgreich verlassen.");
    }

    @Transactional
    public TischAntwort starteTisch(UUID tischId, SpielerEntity spieler) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        TischEntity tisch = ladeTisch(tischId);
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
        tisch.setzePartie(PartieEntity.neu(tisch.konfiguration().anzahlSpiele()));
        return TischAntwort.aus(tischRepository.saveAndFlush(tisch));
    }

    @Transactional(readOnly = true)
    public TischKonfigurationDto ladeKonfiguration(UUID tischId) {
        return TischKonfigurationDto.aus(ladeTisch(tischId).konfiguration());
    }

    @Transactional
    public TischKonfigurationDto aktualisiereKonfiguration(
        UUID tischId,
        SpielerEntity spieler,
        TischKonfigurationDto konfiguration
    ) {
        SpielerEntity verwalteterSpieler = ladeSpieler(spieler.id());
        TischEntity tisch = ladeTisch(tischId);
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
        return TischKonfigurationDto.aus(tischRepository.saveAndFlush(tisch).konfiguration());
    }

    @Transactional(readOnly = true)
    public PartieStandAntwort ladePartieStand(UUID partieId) {
        PartieEntity partie = partieRepository.findById(partieId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "PARTIE_NICHT_GEFUNDEN",
                "Es wurde keine Partie mit der ID " + partieId + " gefunden."
            ));
        return PartieStandAntwort.aus(partie);
    }

    private TischEntity ladeTisch(UUID tischId) {
        return tischRepository.findById(tischId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "TISCH_NICHT_GEFUNDEN",
                "Es wurde kein Tisch mit der ID " + tischId + " gefunden."
            ));
    }

    private SpielerEntity ladeSpieler(UUID spielerId) {
        return spielerRepository.findById(spielerId)
            .orElseThrow(() -> new SpielverwaltungNichtGefundenException(
                "SPIELER_NICHT_GEFUNDEN",
                "Es wurde kein Spieler mit der ID " + spielerId + " gefunden."
            ));
    }

    private void pruefeDassSpielerAnKeinemTischSitzt(SpielerEntity spieler) {
        tischRepository.findBySpieler_Id(spieler.id()).ifPresent(tisch -> {
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
}
