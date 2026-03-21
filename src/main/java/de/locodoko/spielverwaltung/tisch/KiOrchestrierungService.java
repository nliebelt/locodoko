package de.locodoko.spielverwaltung.tisch;

import de.locodoko.spiel.ki.KiArmutAntwort;
import de.locodoko.spiel.ki.KiSpielzustand;
import de.locodoko.spiel.ki.KiStrategie;
import de.locodoko.spiel.karten.Kartendeck;
import de.locodoko.spiel.karten.Karte;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spiel.partie.Ansage;
import de.locodoko.spiel.partie.PunkteRechner;
import de.locodoko.spiel.partie.Spiel;
import de.locodoko.spiel.partie.Spielphase;
import de.locodoko.spiel.partie.Spielergebnis;
import de.locodoko.spiel.partie.VorbehaltAnsage;
import de.locodoko.spielverwaltung.persistenz.PartieEntity;
import de.locodoko.spielverwaltung.persistenz.PartieStatus;
import de.locodoko.spielverwaltung.persistenz.SpielEntity;
import de.locodoko.spielverwaltung.persistenz.SpielerEntity;
import de.locodoko.spielverwaltung.persistenz.TischEntity;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

@Service
public class KiOrchestrierungService {

    private static final int MAXIMALE_KI_AKTIONEN = 512;

    private final KiStrategie kiStrategie;
    private final PunkteRechner punkteRechner = new PunkteRechner();

    public KiOrchestrierungService(KiStrategie kiStrategie) {
        this.kiStrategie = kiStrategie;
    }

    public void automatisiereTisch(TischEntity tisch) {
        Objects.requireNonNull(tisch, "tisch darf nicht null sein");
        if (tisch.partie() == null || tisch.partie().status() == PartieStatus.BEENDET) {
            return;
        }
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
            if (spielerEntity == null || !spielerEntity.istKi()) {
                return;
            }
            Spiel naechsterStand = fuehreKiAktionAus(laufendesSpiel, erwarteterSpieler);
            SpielPersistenzAdapter.uebernehmeDomainSpiel(laufendesSpielEntity, naechsterStand);
        }
        throw new IllegalStateException("Die KI-Orchestrierung hat das Sicherheitslimit erreicht.");
    }

    private Spiel fuehreKiAktionAus(Spiel laufendesSpiel, SpielerPosition spielerPosition) {
        KiSpielzustand zustand = KiSpielzustand.aus(laufendesSpiel, spielerPosition);
        return switch (laufendesSpiel.phase()) {
            case VORBEHALT_ANSAGE -> {
                VorbehaltAnsage vorbehalt = kiStrategie.waehleVorbehalt(zustand);
                Spiel spielNachVorbehalt = laufendesSpiel.meldeVorbehalt(spielerPosition, vorbehalt);
                yield spielNachVorbehalt.phase() == Spielphase.VORBEHALT_AUFLOESUNG
                    ? spielNachVorbehalt.loeseVorbehalteAuf()
                    : spielNachVorbehalt;
            }
            case ARMUT_TAUSCH -> {
                if (laufendesSpiel.armutStatus().filter(status -> status.armutSpieler() == spielerPosition && !status.angebotLiegtVor()).isPresent()) {
                    yield laufendesSpiel.legeArmutTrumpfkarten(spielerPosition, kiStrategie.waehleArmutAngebot(zustand));
                }
                KiArmutAntwort armutAntwort = kiStrategie.waehleArmutAntwort(zustand);
                yield armutAntwort.angenommen()
                    ? laufendesSpiel.nimmArmutAn(spielerPosition, armutAntwort.rueckgabekarten())
                    : laufendesSpiel.lehneArmutAb(spielerPosition);
            }
            case STICHPHASE -> {
                Ansage ansage = kiStrategie.waehleAnsage(zustand).orElse(null);
                if (ansage != null) {
                    yield laufendesSpiel.sageAn(spielerPosition, ansage);
                }
                Karte karte = kiStrategie.waehleKarte(zustand);
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
        for (SpielerPosition position : SpielerPosition.standardReihenfolge()) {
            int neuerWert = partie.gesamtpunktestand().getOrDefault(position, 0) + spielergebnis.spielpunkteVon(position);
            partie.setzeGesamtpunktestand(position, neuerWert);
        }
        long abgeschlosseneSpiele = partie.spiele().stream().filter(spiel -> spiel.ergebnis() != null).count();
        if (abgeschlosseneSpiele >= partie.anzahlSpiele()) {
            partie.markiereAlsBeendet();
            return;
        }
        Spiel neuesSpiel = Spiel.neu(
            laufendesSpiel.geber().naechsteImUhrzeigersinn(),
            tisch.konfiguration().alsSpielregeln(),
            Kartendeck.neu(tisch.konfiguration().alsSpielregeln()).gemischt()
        ).teileKartenAus();
        SpielEntity neuesSpielEntity = SpielEntity.neu(
            partie.aktuellesSpielNummer() + 1,
            neuesSpiel.geber(),
            neuesSpiel.spieltyp(),
            neuesSpiel.phase()
        );
        SpielPersistenzAdapter.uebernehmeDomainSpiel(neuesSpielEntity, neuesSpiel);
        partie.fuegeSpielHinzu(neuesSpielEntity);
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
