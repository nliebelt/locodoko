package de.locodoko.ki.orchestrierung;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.NormaleTrumpfOrdnung;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.karten.TrumpfOrdnung;
import de.locodoko.ki.KiArmutAntwort;
import de.locodoko.ki.KiSchwierigkeit;
import de.locodoko.ki.KiStrategie;
import de.locodoko.ki.KiStrategieFactory;
import de.locodoko.partie.Ansage;
import de.locodoko.partie.Ansagen;
import de.locodoko.partie.ArmutStatus;
import de.locodoko.partie.Partei;
import de.locodoko.partie.Parteien;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.SpielEreignis;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Stich;
import de.locodoko.partie.VorbehaltAnsage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit-Tests für {@link KiOrchestrierungService}.
 *
 * <p>Testet alle Phasenzweige der Switch-Anweisung: KartenAusteilen (Default), VorbehaltAnsage,
 * ArmutTausch (Anbieter / Annehmer+annimmt / Annehmer+lehnt ab) und Stichphase
 * (Pflichtansage-RE, Pflichtansage-KONTRA, Pflichtansage-nicht-eigene-Partei, optionale Ansage,
 * Karte spielen). Für einfache Phasenzustände werden echte Spiel-Objekte verwendet; für
 * Zweige, die spezifische Feld­zustände erfordern (ArmutTausch, Stichphase-Pflichtansagen),
 * wird das Spiel-Objekt mit Mockito gemockt.</p>
 */
@ExtendWith(MockitoExtension.class)
class KiOrchestrierungServiceTest {

    @Mock private KiStrategieFactory strategieFactory;
    @Mock private KiStrategie strategie;
    @Mock private Spiel spiel;

    private KiOrchestrierungService service;

    private static final Spielregeln REGELN = Spielregeln.standardRegeln();
    private static final TrumpfOrdnung TRUMPF_ORDNUNG = new NormaleTrumpfOrdnung(REGELN);

    @BeforeEach
    void setUp() {
        when(strategieFactory.erzeuge(any())).thenReturn(strategie);
        service = new KiOrchestrierungService(strategieFactory);
    }

    /**
     * Setzt alle Methoden, die {@code KiSpielzustand.aus()} auf dem Spiel-Mock aufruft, als
     * lenient Stubs – damit Mockito bei Tests, die nicht alle Methoden auslösen, nicht mit
     * „unnecessary stubbing" abbricht.
     */
    private void stubFuerKiSpielzustand() {
        lenient().when(spiel.spieltyp()).thenReturn(Spieltyp.NORMALSPIEL);
        lenient().when(spiel.spielregeln()).thenReturn(REGELN);
        lenient().when(spiel.trumpfOrdnung()).thenReturn(TRUMPF_ORDNUNG);
        lenient().when(spiel.handVon(any())).thenReturn(new Hand(List.of()));
        lenient().when(spiel.parteien()).thenReturn(Parteien.ausSolo(SpielerPosition.WEST));
        lenient().when(spiel.ansagen()).thenReturn(Ansagen.leer());
        lenient().when(spiel.abgeschlosseneStiche()).thenReturn(List.of());
        lenient().when(spiel.aktuellerStich()).thenReturn(Optional.empty());
        lenient().when(spiel.hochzeitStatus()).thenReturn(Optional.empty());
        lenient().when(spiel.erwarteterSpieler()).thenReturn(Optional.empty());
        lenient().when(spiel.kannAnsagen(any(), any())).thenReturn(false);
    }

    // ─── Default-Phase (KartenAusteilen) ───────────────────────────────────────

    /**
     * Ein frisches Spiel vor teileKartenAus() befindet sich in KartenAusteilen-Phase.
     * Diese fällt in den default-Zweig des Switch → kein Strategie-Aufruf, kein Kartenzug,
     * keine Ereignisse.
     */
    @Test
    void kartenAusteilenPhase_gibtErgebnisOhneKarteUndEreignisseZurueck() {
        Spiel echtesspiel = Spiel.neu(SpielerPosition.SUED, REGELN, Kartendeck.neu(REGELN).gemischt());
        assertInstanceOf(Spielphase.KartenAusteilen.class, echtesspiel.phase());

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(echtesspiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        assertSame(echtesspiel, ergebnis.naechsterStand(),
            "Im Default-Zweig muss das unveraenderte Spiel zurueckgegeben werden.");
        assertNull(ergebnis.gespielteKarteId(),
            "Im Default-Zweig darf keine Karte gespielt worden sein.");
        assertTrue(ergebnis.ereignisse().isEmpty(),
            "Im Default-Zweig darf kein Ereignis entstehen.");
        verifyNoInteractions(strategie);
    }

    // ─── VorbehaltAnsage ───────────────────────────────────────────────────────

    /**
     * Normaler Vorbehalt-Aufruf: Der Service delegiert an die Strategie, meldet den
     * gewaehlten Vorbehalt und gibt ein Ergebnis ohne gespielte Karte zurueck.
     */
    @Test
    void vorbehaltAnsage_ruftStrategieAufUndMeldetVorbehalt() {
        Spiel echtesspiel = Spiel.neu(SpielerPosition.SUED, REGELN, Kartendeck.neu(REGELN).gemischt());
        echtesspiel.teileKartenAus();
        assertInstanceOf(Spielphase.VorbehaltAnsage.class, echtesspiel.phase());
        SpielerPosition ersterSpieler = echtesspiel.erwarteterSpieler().orElseThrow();

        when(strategie.waehleVorbehalt(any())).thenReturn(VorbehaltAnsage.GESUND);

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(echtesspiel, ersterSpieler, KiSchwierigkeit.LEICHT);

        verify(strategie).waehleVorbehalt(any());
        assertNull(ergebnis.gespielteKarteId(),
            "In der VorbehaltAnsage-Phase darf keine Karte gespielt werden.");
        assertTrue(ergebnis.ereignisse().isEmpty());
    }

    /**
     * Wenn der letzte Spieler seinen Vorbehalt gemeldet hat, wechselt die Phase zur
     * VorbehaltAufloesung. Der Service muss {@code loeseVorbehalteAuf()} aufrufen,
     * sodass die Phase danach Stichphase (Normalspiel) oder ArmutTausch ist – nicht mehr
     * VorbehaltAnsage oder VorbehaltAufloesung.
     */
    @Test
    void vorbehaltAnsage_letzterSpielerLoestVorbehalteAufAutomatisch() {
        Spiel echtesspiel = erstelleSpielVorLetztemVorbehalt();
        when(strategie.waehleVorbehalt(any())).thenReturn(VorbehaltAnsage.GESUND);

        service.fuehreAktionAus(echtesspiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        assertFalse(echtesspiel.phase() instanceof Spielphase.VorbehaltAnsage,
            "Nach dem letzten GESUND-Vorbehalt muss die VorbehaltAnsage-Phase abgeschlossen sein.");
        assertFalse(echtesspiel.phase() instanceof Spielphase.VorbehaltAufloesung,
            "loeseVorbehalteAuf() muss die VorbehaltAufloesung aufloesen – die Phase darf nicht darin haengen.");
    }

    // ─── ArmutTausch ───────────────────────────────────────────────────────────

    /**
     * Wenn der ArmutSpieler noch kein Angebot abgegeben hat, muss der Service
     * {@code legeArmutTrumpfkarten()} aufrufen (Anbieter-Zweig).
     */
    @Test
    void armutTausch_anbieterLegtArmutTrumpfkartenAb() {
        ArmutStatus armutStatus = ArmutStatus.gestartet(SpielerPosition.WEST);
        when(spiel.phase()).thenReturn(new Spielphase.ArmutTausch(armutStatus));
        when(spiel.armutStatus()).thenReturn(Optional.of(armutStatus));
        stubFuerKiSpielzustand();

        List<Karte> angeboteneKarten = List.of(new Karte(Farbe.KARO, Kartenwert.NEUN, 1));
        when(strategie.waehleArmutAngebot(any())).thenReturn(angeboteneKarten);

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.WEST, KiSchwierigkeit.LEICHT);

        verify(strategie).waehleArmutAngebot(any());
        verify(spiel).legeArmutTrumpfkarten(SpielerPosition.WEST, angeboteneKarten);
        verify(spiel, never()).nimmArmutAn(any(), any());
        verify(spiel, never()).lehneArmutAb(any());
        assertNull(ergebnis.gespielteKarteId());
    }

    /**
     * Wenn die Strategie die Armut annimmt, muss der Service {@code nimmArmutAn()}
     * mit den von der Strategie gewaehlten Rueckgabekarten aufrufen.
     */
    @Test
    void armutTausch_annehmerNimmtArmutAnWennStrategieAnnehmenZurueckgibt() {
        ArmutStatus armutMitAngebot = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(new Karte(Farbe.KARO, Kartenwert.NEUN, 1)));
        when(spiel.phase()).thenReturn(new Spielphase.ArmutTausch(armutMitAngebot));
        when(spiel.armutStatus()).thenReturn(Optional.of(armutMitAngebot));
        stubFuerKiSpielzustand();

        List<Karte> rueckgabekarten = List.of(new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1));
        when(strategie.waehleArmutAntwort(any())).thenReturn(KiArmutAntwort.annehmen(rueckgabekarten));

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.NORD, KiSchwierigkeit.LEICHT);

        verify(strategie).waehleArmutAntwort(any());
        verify(spiel).nimmArmutAn(SpielerPosition.NORD, rueckgabekarten);
        verify(spiel, never()).lehneArmutAb(any());
        assertNull(ergebnis.gespielteKarteId());
    }

    /**
     * Wenn die Strategie die Armut ablehnt, muss der Service {@code lehneArmutAb()} aufrufen.
     */
    @Test
    void armutTausch_annehmerLehntArmutAb() {
        ArmutStatus armutMitAngebot = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(new Karte(Farbe.KARO, Kartenwert.NEUN, 1)));
        when(spiel.phase()).thenReturn(new Spielphase.ArmutTausch(armutMitAngebot));
        when(spiel.armutStatus()).thenReturn(Optional.of(armutMitAngebot));
        stubFuerKiSpielzustand();

        when(strategie.waehleArmutAntwort(any())).thenReturn(KiArmutAntwort.ablehnen());

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.NORD, KiSchwierigkeit.LEICHT);

        verify(strategie).waehleArmutAntwort(any());
        verify(spiel).lehneArmutAb(SpielerPosition.NORD);
        verify(spiel, never()).nimmArmutAn(any(), any());
        assertNull(ergebnis.gespielteKarteId());
    }

    // ─── Stichphase ────────────────────────────────────────────────────────────

    /**
     * Wenn fuer die RE-Partei eine Pflichtansage aussteht und der KI-Spieler RE ist,
     * muss der Service RE ansagen und ohne Kartenzug abbrechen.
     */
    @Test
    void stichphase_pflichtansageRe_sagtRe() {
        Spielphase.Stichphase phase = new Spielphase.Stichphase(
            Stich.neu(SpielerPosition.SUED), Set.of(Partei.RE), null);
        when(spiel.phase()).thenReturn(phase);
        when(spiel.pflichtansageAusstehend()).thenReturn(Set.of(Partei.RE));
        when(spiel.parteiVon(SpielerPosition.SUED)).thenReturn(Partei.RE);
        stubFuerKiSpielzustand();

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        verify(spiel).sageAn(SpielerPosition.SUED, Ansage.RE);
        assertNull(ergebnis.gespielteKarteId(),
            "Bei Pflichtansage darf kein Kartenzug stattfinden.");
        verifyNoInteractions(strategie);
    }

    /**
     * Wenn fuer die KONTRA-Partei eine Pflichtansage aussteht und der KI-Spieler KONTRA ist,
     * muss der Service KONTRA ansagen und ohne Kartenzug abbrechen.
     */
    @Test
    void stichphase_pflichtansageKontra_sagtKontra() {
        Spielphase.Stichphase phase = new Spielphase.Stichphase(
            Stich.neu(SpielerPosition.SUED), Set.of(Partei.KONTRA), null);
        when(spiel.phase()).thenReturn(phase);
        when(spiel.pflichtansageAusstehend()).thenReturn(Set.of(Partei.KONTRA));
        when(spiel.parteiVon(SpielerPosition.NORD)).thenReturn(Partei.KONTRA);
        stubFuerKiSpielzustand();

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.NORD, KiSchwierigkeit.LEICHT);

        verify(spiel).sageAn(SpielerPosition.NORD, Ansage.KONTRA);
        assertNull(ergebnis.gespielteKarteId());
        verifyNoInteractions(strategie);
    }

    /**
     * Wenn Pflichtansagen aussstehen, aber nicht fuer die eigene Partei des KI-Spielers,
     * muss der Service zur normalen Karten-/Ansage-Entscheidung fallen – keine Pflichtansage,
     * stattdessen Karte spielen. Wichtig: Nur weil die andere Partei noch ansagen muss,
     * darf der eigene Zug nicht blockiert werden.
     */
    @Test
    void stichphase_pflichtansagenNichtFuerEigenePartei_spieltKarte() {
        Karte karte = new Karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        Spielphase.Stichphase phase = new Spielphase.Stichphase(
            Stich.neu(SpielerPosition.SUED), Set.of(Partei.KONTRA), null);
        when(spiel.phase()).thenReturn(phase);
        when(spiel.pflichtansageAusstehend()).thenReturn(Set.of(Partei.KONTRA));
        when(spiel.parteiVon(SpielerPosition.SUED)).thenReturn(Partei.RE);
        // gueltigeKartenFuer wird aufgerufen wenn erwarteterSpieler gesetzt ist
        when(spiel.erwarteterSpieler()).thenReturn(Optional.of(SpielerPosition.SUED));
        when(spiel.gueltigeKartenFuer(SpielerPosition.SUED)).thenReturn(List.of(karte));
        stubFuerKiSpielzustand();

        when(strategie.waehleAnsage(any())).thenReturn(Optional.empty());
        when(strategie.waehleKarte(any())).thenReturn(karte);
        when(spiel.spieleKarte(SpielerPosition.SUED, karte)).thenReturn(List.of());

        service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        verify(spiel).spieleKarte(SpielerPosition.SUED, karte);
        verify(spiel, never()).sageAn(any(), any());
    }

    /**
     * Wenn die Strategie eine optionale Ansage zurueckgibt (aber keine Pflichtansage
     * aussteht), muss der Service die Ansage melden und ohne Kartenzug abbrechen.
     * Erst beim naechsten fuehreAktionAus-Aufruf wird eine Karte gespielt.
     */
    @Test
    void stichphase_optionaleAnsage_sagtAnsageOhneKartenZug() {
        Spielphase.Stichphase phase = new Spielphase.Stichphase(
            Stich.neu(SpielerPosition.SUED), Set.of(), null);
        when(spiel.phase()).thenReturn(phase);
        when(spiel.pflichtansageAusstehend()).thenReturn(Set.of());
        stubFuerKiSpielzustand();

        when(strategie.waehleAnsage(any())).thenReturn(Optional.of(Ansage.RE));

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        verify(spiel).sageAn(SpielerPosition.SUED, Ansage.RE);
        verify(spiel, never()).spieleKarte(any(), any());
        assertNull(ergebnis.gespielteKarteId(),
            "Nach einer optionalen Ansage darf keine Karte gespielt werden.");
        assertTrue(ergebnis.ereignisse().isEmpty());
    }

    /**
     * Wenn weder Pflichtansage noch optionale Ansage vorliegt, muss der Service
     * eine Karte spielen und deren ID sowie die resultierenden Ereignisse zurueckgeben.
     */
    @Test
    void stichphase_ohneAnsage_spieltKarteUndGibtEreignisseZurueck() {
        Karte karte = new Karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        List<SpielEreignis> ereignisse = List.of(
            new SpielEreignis.KarteGespielt(SpielerPosition.SUED, karte));
        Spielphase.Stichphase phase = new Spielphase.Stichphase(
            Stich.neu(SpielerPosition.SUED), Set.of(), null);
        when(spiel.phase()).thenReturn(phase);
        when(spiel.pflichtansageAusstehend()).thenReturn(Set.of());
        when(spiel.erwarteterSpieler()).thenReturn(Optional.of(SpielerPosition.SUED));
        when(spiel.gueltigeKartenFuer(SpielerPosition.SUED)).thenReturn(List.of(karte));
        stubFuerKiSpielzustand();

        when(strategie.waehleAnsage(any())).thenReturn(Optional.empty());
        when(strategie.waehleKarte(any())).thenReturn(karte);
        when(spiel.spieleKarte(SpielerPosition.SUED, karte)).thenReturn(ereignisse);

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        verify(spiel).spieleKarte(SpielerPosition.SUED, karte);
        assertEquals(karte.karteId(), ergebnis.gespielteKarteId(),
            "Die ID der gespielten Karte muss im Ergebnis stehen.");
        assertEquals(ereignisse, ergebnis.ereignisse(),
            "Alle durch spieleKarte ausgeloesten Ereignisse muessen weitergeleitet werden.");
    }

    // ─── Hilfsmethoden ─────────────────────────────────────────────────────────

    /**
     * Erstellt ein Spiel mit SUED als Geber, in dem die ersten drei Spieler (WEST, NORD, OST)
     * bereits GESUND gemeldet haben. SUED ist damit der letzte Spieler, dessen Vorbehalt
     * die VorbehaltAufloesung ausloest.
     *
     * Iteriert ueber verschiedene Kartendeck-Seeds, bis ein Normalspiel-faehiges Deck
     * gefunden wird (beide Kreuz-Damen auf unterschiedliche Spieler verteilt).
     */
    private Spiel erstelleSpielVorLetztemVorbehalt() {
        for (long seed = 0; seed < 100; seed++) {
            try {
                Spiel s = Spiel.neu(SpielerPosition.SUED, REGELN,
                    Kartendeck.neu(REGELN).gemischt(new Random(seed)));
                s.teileKartenAus();
                s.meldeVorbehalt(SpielerPosition.WEST, VorbehaltAnsage.GESUND);
                s.meldeVorbehalt(SpielerPosition.NORD, VorbehaltAnsage.GESUND);
                s.meldeVorbehalt(SpielerPosition.OST, VorbehaltAnsage.GESUND);
                return s;
            } catch (Exception e) {
                // ungueltige Kartenverteilung — naechster Seed
            }
        }
        throw new IllegalStateException("Kein gueltiges Normalspiel-Deck in 100 Versuchen gefunden");
    }
}
