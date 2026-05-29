package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TischKonfigurationsService {

    private final TischZugriff tischZugriff;
    private final TischRepository tischRepository;
    private final TischEchtzeitService tischEchtzeitService;

    public TischKonfigurationsService(
        TischZugriff tischZugriff,
        TischRepository tischRepository,
        TischEchtzeitService tischEchtzeitService
    ) {
        this.tischZugriff = tischZugriff;
        this.tischRepository = tischRepository;
        this.tischEchtzeitService = tischEchtzeitService;
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
        List<TischListenEintragAntwort> offeneTische = tischRepository
            .findAllByStatusOrderByErstelltAmAsc(TischStatus.WARTEND)
            .stream()
            .filter(t -> t.zugangsmodus() == Zugangsmodus.OFFEN)
            .map(TischListenEintragAntwort::aus)
            .toList();
        tischEchtzeitService.planeTischliste(TischlisteEreignisAntwort.aktualisiert(offeneTische));
        tischEchtzeitService.planeTischEreignis(TischEreignisAntwort.aktualisiert(
            TischEreignisTyp.TISCH_KONFIGURATION_AKTUALISIERT,
            TischAntwort.aus(gespeicherterTisch)
        ));
        return TischKonfigurationDto.aus(gespeicherterTisch.konfiguration());
    }
}
