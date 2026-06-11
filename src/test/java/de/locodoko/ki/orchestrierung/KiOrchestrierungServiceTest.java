package de.locodoko.ki.orchestrierung;

import de.locodoko.karten.*;
import de.locodoko.ki.*;
import de.locodoko.partie.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit-Tests für {@link KiOrchestrierungService} ohne Mockito.
 */
class KiOrchestrierungServiceTest {

    private KiOrchestrierungService service;
    private FakeKiStrategie strategie;
    private FakeSpiel spiel;

    @BeforeEach
    void setUp() {
        strategie = new FakeKiStrategie();
        FakeKiStrategieFactory factory = new FakeKiStrategieFactory(strategie);
        service = new KiOrchestrierungService(factory);
        spiel = new FakeSpiel();
    }

    @Test
    void kartenAusteilenPhase_gibtErgebnisOhneKarteUndEreignisseZurueck() {
        spiel.mockPhase = new Spielphase.KartenAusteilen();
        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        assertSame(spiel, ergebnis.naechsterStand());
        assertNull(ergebnis.gespielteKarteId());
        assertTrue(ergebnis.ereignisse().isEmpty());
    }

    @Test
    void vorbehaltAnsage_meldetVorbehalt() {
        spiel.mockPhase = Spielphase.VORBEHALT_ANSAGE;
        strategie.vorbehalt = VorbehaltAnsage.GESUND;

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        assertTrue(spiel.meldeVorbehaltCalled);
        assertNull(ergebnis.gespielteKarteId());
    }

    @Test
    void vorbehaltAnsage_letzterSpielerLoestAuf() {
        spiel.mockPhase = Spielphase.VORBEHALT_ANSAGE;
        strategie.vorbehalt = VorbehaltAnsage.GESUND;
        // Simulieren, dass meldeVorbehalt die Phase aendert (wirkt als letzter Spieler)
        spiel.onMeldeVorbehalt = () -> spiel.mockPhase = Spielphase.VORBEHALT_AUFLOESUNG;

        service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        assertTrue(spiel.loeseVorbehalteAufCalled);
    }

    @Test
    void armutTausch_anbieterLegtAb() {
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST);
        spiel.mockPhase = new Spielphase.ArmutTausch(status);
        spiel.mockArmutStatus = Optional.of(status);

        List<Karte> angebot = List.of(new Karte(Farbe.KARO, Kartenwert.NEUN, 1));
        strategie.armutAngebot = angebot;

        service.fuehreAktionAus(spiel, SpielerPosition.WEST, KiSchwierigkeit.LEICHT);

        assertTrue(spiel.legeArmutTrumpfkartenCalled);
        assertFalse(spiel.nimmArmutAnCalled);
    }

    @Test
    void armutTausch_annehmerNimmtAn() {
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(new Karte(Farbe.KARO, Kartenwert.NEUN, 1)));
        spiel.mockPhase = new Spielphase.ArmutTausch(status);
        spiel.mockArmutStatus = Optional.of(status);

        strategie.armutAntwort = KiArmutAntwort.annehmen(List.of(new Karte(Farbe.HERZ, Kartenwert.KOENIG, 1)));

        service.fuehreAktionAus(spiel, SpielerPosition.NORD, KiSchwierigkeit.LEICHT);

        assertTrue(spiel.nimmArmutAnCalled);
    }

    @Test
    void armutTausch_annehmerLehntAb() {
        ArmutStatus status = ArmutStatus.gestartet(SpielerPosition.WEST)
            .mitAngebot(List.of(new Karte(Farbe.KARO, Kartenwert.NEUN, 1)));
        spiel.mockPhase = new Spielphase.ArmutTausch(status);
        spiel.mockArmutStatus = Optional.of(status);

        strategie.armutAntwort = KiArmutAntwort.ablehnen();

        service.fuehreAktionAus(spiel, SpielerPosition.NORD, KiSchwierigkeit.LEICHT);

        assertTrue(spiel.lehneArmutAbCalled);
    }

    @Test
    void stichphase_pflichtansageRe_sagtRe() {
        spiel.mockPhase = new Spielphase.Stichphase(Stich.neu(SpielerPosition.SUED), Set.of(Partei.RE), null);
        spiel.mockPflicht = Set.of(Partei.RE);
        spiel.mockPartei = Partei.RE;

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        assertTrue(spiel.sageAnCalled);
        assertEquals(Ansage.RE, spiel.gemeldeteAnsage);
        assertNull(ergebnis.gespielteKarteId());
    }

    @Test
    void stichphase_pflichtansageKontra_sagtKontra() {
        spiel.mockPhase = new Spielphase.Stichphase(Stich.neu(SpielerPosition.SUED), Set.of(Partei.KONTRA), null);
        spiel.mockPflicht = Set.of(Partei.KONTRA);
        spiel.mockPartei = Partei.KONTRA;

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.NORD, KiSchwierigkeit.LEICHT);

        assertTrue(spiel.sageAnCalled);
        assertEquals(Ansage.KONTRA, spiel.gemeldeteAnsage);
        assertNull(ergebnis.gespielteKarteId());
    }

    @Test
    void stichphase_pflichtansagenNichtEigenePartei_spieltKarte() {
        spiel.mockPhase = new Spielphase.Stichphase(Stich.neu(SpielerPosition.SUED), Set.of(Partei.KONTRA), null);
        spiel.mockPflicht = Set.of(Partei.KONTRA);
        spiel.mockPartei = Partei.RE;

        Karte karte = new Karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        strategie.karte = karte;
        spiel.mockEreignisse = List.of();

        service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        assertFalse(spiel.sageAnCalled);
        assertTrue(spiel.spieleKarteCalled);
        assertEquals(karte, spiel.gespielteKarte);
    }

    @Test
    void stichphase_optionaleAnsage() {
        spiel.mockPhase = new Spielphase.Stichphase(Stich.neu(SpielerPosition.SUED), Set.of(), null);
        strategie.ansage = Optional.of(Ansage.RE);

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        assertTrue(spiel.sageAnCalled);
        assertEquals(Ansage.RE, spiel.gemeldeteAnsage);
        assertFalse(spiel.spieleKarteCalled);
    }

    @Test
    void stichphase_spieltKarte() {
        spiel.mockPhase = new Spielphase.Stichphase(Stich.neu(SpielerPosition.SUED), Set.of(), null);
        Karte karte = new Karte(Farbe.KREUZ, Kartenwert.DAME, 1);
        strategie.karte = karte;
        spiel.mockEreignisse = List.of(new SpielEreignis.KarteGespielt(SpielerPosition.SUED, karte));

        KiAktionErgebnis ergebnis = service.fuehreAktionAus(spiel, SpielerPosition.SUED, KiSchwierigkeit.LEICHT);

        assertTrue(spiel.spieleKarteCalled);
        assertEquals(karte, spiel.gespielteKarte);
        assertEquals(karte.karteId(), ergebnis.gespielteKarteId());
        assertEquals(1, ergebnis.ereignisse().size());
    }

    // --- Fake Classes ---

    private static class FakeKiStrategieFactory extends KiStrategieFactory {
        final KiStrategie strategie;
        FakeKiStrategieFactory(KiStrategie strategie) { this.strategie = strategie; }
        @Override public KiStrategie erzeuge(KiSchwierigkeit schwierigkeit) { return strategie; }
    }

    private static class FakeKiStrategie implements KiStrategie {
        VorbehaltAnsage vorbehalt;
        List<Karte> armutAngebot;
        KiArmutAntwort armutAntwort;
        Optional<Ansage> ansage = Optional.empty();
        Karte karte;

        @Override public VorbehaltAnsage waehleVorbehalt(KiSpielzustand z) { return vorbehalt; }
        @Override public List<Karte> waehleArmutAngebot(KiSpielzustand z) { return armutAngebot; }
        @Override public KiArmutAntwort waehleArmutAntwort(KiSpielzustand z) { return armutAntwort; }
        @Override public Optional<Ansage> waehleAnsage(KiSpielzustand z) { return ansage; }
        @Override public Karte waehleKarte(KiSpielzustand z) { return karte; }
    }

    private static class FakeSpiel extends Spiel {
        Spielphase mockPhase;
        Optional<ArmutStatus> mockArmutStatus = Optional.empty();
        Set<Partei> mockPflicht = Set.of();
        Partei mockPartei = Partei.RE;
        Optional<SpielerPosition> mockErwarteterSpieler = Optional.of(SpielerPosition.SUED);
        List<Karte> mockGueltigeKarten = List.of();
        List<SpielEreignis> mockEreignisse = List.of();

        boolean meldeVorbehaltCalled;
        Runnable onMeldeVorbehalt;
        boolean loeseVorbehalteAufCalled;
        boolean legeArmutTrumpfkartenCalled;
        boolean nimmArmutAnCalled;
        boolean lehneArmutAbCalled;
        boolean sageAnCalled;
        Ansage gemeldeteAnsage;
        boolean spieleKarteCalled;
        Karte gespielteKarte;

        @Override public Spielphase phase() { return mockPhase; }
        @Override public Optional<ArmutStatus> armutStatus() { return mockArmutStatus; }
        @Override public Set<Partei> pflichtansageAusstehend() { return mockPflicht; }
        @Override public Partei parteiVon(SpielerPosition pos) { return mockPartei; }
        @Override public Optional<SpielerPosition> erwarteterSpieler() { return mockErwarteterSpieler; }
        @Override public List<Karte> gueltigeKartenFuer(SpielerPosition p) { return mockGueltigeKarten; }

        @Override public List<SpielEreignis> meldeVorbehalt(SpielerPosition pos, VorbehaltAnsage v) { 
            meldeVorbehaltCalled = true; 
            if (onMeldeVorbehalt != null) onMeldeVorbehalt.run();
            return List.of();
        }
        @Override public List<SpielEreignis> loeseVorbehalteAuf() { loeseVorbehalteAufCalled = true; return List.of(); }
        @Override public List<SpielEreignis> legeArmutTrumpfkarten(SpielerPosition p, List<Karte> k) { legeArmutTrumpfkartenCalled = true; return List.of(); }
        @Override public List<SpielEreignis> nimmArmutAn(SpielerPosition p, List<Karte> k) { nimmArmutAnCalled = true; return List.of(); }
        @Override public List<SpielEreignis> lehneArmutAb(SpielerPosition p) { lehneArmutAbCalled = true; return List.of(); }
        @Override public List<SpielEreignis> sageAn(SpielerPosition p, Ansage a) { sageAnCalled = true; gemeldeteAnsage = a; return List.of(); }
        @Override public List<SpielEreignis> spieleKarte(SpielerPosition p, Karte k) { 
            spieleKarteCalled = true; 
            gespielteKarte = k; 
            return mockEreignisse; 
        }

        // Dummies fuer KiSpielzustand.aus(...)
        @Override public Spielregeln spielregeln() { return Spielregeln.standardRegeln(); }
        @Override public Spieltyp spieltyp() { return Spieltyp.NORMALSPIEL; }
        @Override public TrumpfOrdnung trumpfOrdnung() { return new NormaleTrumpfOrdnung(spielregeln()); }
        @Override public Hand handVon(SpielerPosition p) { return new Hand(List.of()); }
        @Override public Parteien parteien() { return Parteien.ausSolo(SpielerPosition.WEST); }
        @Override public Ansagen ansagen() { return Ansagen.leer(); }
        @Override public List<Stich> abgeschlosseneStiche() { return List.of(); }
        @Override public Optional<Stich> aktuellerStich() { return Optional.empty(); }
        @Override public Optional<HochzeitStatus> hochzeitStatus() { return Optional.empty(); }
        @Override public boolean kannAnsagen(SpielerPosition p, Ansage a) { return false; }
    }
}
