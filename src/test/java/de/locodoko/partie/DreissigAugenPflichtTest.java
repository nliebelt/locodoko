package de.locodoko.partie;

import de.locodoko.karten.Farbe;
import de.locodoko.karten.Hand;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests fuer die Dreissig-Augen-Pflicht-Regel.
 *
 * <p>Nach dem 1. oder 2. Stich mit mehr als 30 Augen muss die gewinnende Partei
 * eine Grundansage (Re oder Kontra) machen bevor die naechste Karte gespielt werden darf.
 * Gilt nur bei NORMALSPIEL und HOCHZEIT; Soli sind ausgeschlossen.</p>
 */
class DreissigAugenPflichtTest {

    private final Spielregeln mitPflicht = Spielregeln.standardRegeln().mitDreissigAugenPflichtAktiv(true);
    private final Spielregeln ohnePflicht = Spielregeln.standardRegeln();

    // --- Trigger: Pflichtansage wird gesetzt ---

    @Test
    void spieleKarteSetzt_PflichtansageNachStich1Mit31PlusAugen() {
        // Wichtig: Der Kerntrigger — nach einem hochwertigen Stich 1 muss die
        // gewinnende Partei blockiert werden, bevor sie die naechste Karte spielen darf.
        // WEST (KONTRA) gewinnt Stich 1 mit 36 Augen → KONTRA muss Pflichtansage machen.
        Karte westKarte = new Karte(Farbe.PIK, Kartenwert.AS, 1);     // 11
        Karte nordKarte = new Karte(Farbe.PIK, Kartenwert.AS, 2);     // 11
        Karte ostKarte  = new Karte(Farbe.PIK, Kartenwert.ZEHN, 1);   // 10
        Karte suedKarte = new Karte(Farbe.PIK, Kartenwert.KOENIG, 1); // 4  → Gesamt: 36

        Spiel nachStich = spieleViertaKarteImStich(
            mitPflicht, Spieltyp.NORMALSPIEL,
            SpielerPosition.WEST, westKarte, nordKarte, ostKarte,
            SpielerPosition.SUED, suedKarte
        );

        assertTrue(nachStich.pflichtansageAusstehend().contains(Partei.KONTRA),
            "WEST (KONTRA) gewinnt Stich 1 mit 36 Augen — KONTRA muss Pflichtansage machen.");
        assertFalse(nachStich.pflichtansageAusstehend().contains(Partei.RE),
            "RE hat keinen Hochwertstich gewonnen — RE darf nicht blockiert werden.");
    }

    @Test
    void spieleKarteSetzt_PflichtansageNachStich2Mit31PlusAugen() {
        // Wichtig: Die Pflichtansage gilt auch fuer den zweiten Stich, aber nicht danach.
        // Ein erster normaler Stich, dann ein hochwertiger zweiter Stich → Block nach Stich 2.
        Karte westKarte = new Karte(Farbe.PIK, Kartenwert.AS, 1);     // 11
        Karte nordKarte = new Karte(Farbe.PIK, Kartenwert.AS, 2);     // 11
        Karte ostKarte  = new Karte(Farbe.PIK, Kartenwert.ZEHN, 1);   // 10
        Karte suedKarte = new Karte(Farbe.PIK, Kartenwert.KOENIG, 1); // 4  → Gesamt: 36

        // Erster Stich bereits abgeschlossen (mit niedrigen Augen)
        Stich ersterStich = Stich.ausPersistiertemStand(SpielerPosition.WEST, List.of(
            new GespielteKarte(SpielerPosition.WEST, new Karte(Farbe.PIK, Kartenwert.NEUN, 1), 1),
            new GespielteKarte(SpielerPosition.NORD, new Karte(Farbe.PIK, Kartenwert.NEUN, 2), 2),
            new GespielteKarte(SpielerPosition.OST,  new Karte(Farbe.PIK, Kartenwert.BUBE, 1), 3),
            new GespielteKarte(SpielerPosition.SUED, new Karte(Farbe.PIK, Kartenwert.DAME, 1), 4)
        ));

        Spiel nachStich = spieleViertaKarteImStich(
            mitPflicht, Spieltyp.NORMALSPIEL,
            SpielerPosition.WEST, westKarte, nordKarte, ostKarte,
            SpielerPosition.SUED, suedKarte,
            List.of(ersterStich)
        );

        assertTrue(nachStich.pflichtansageAusstehend().contains(Partei.KONTRA),
            "WEST (KONTRA) gewinnt Stich 2 mit 36 Augen — KONTRA muss Pflichtansage machen.");
    }

    @Test
    void spieleKarteSetzt_KeinePflichtansageNachStich3Plus() {
        // Wichtig: Ab Stich 3 darf die Pflichtansage nicht mehr ausgeloest werden.
        // Schutzt gegen faelschliche Blockierung spaeter Stiche.
        Karte westKarte = new Karte(Farbe.PIK, Kartenwert.AS, 1);     // 11
        Karte nordKarte = new Karte(Farbe.PIK, Kartenwert.AS, 2);     // 11
        Karte ostKarte  = new Karte(Farbe.PIK, Kartenwert.ZEHN, 1);   // 10
        Karte suedKarte = new Karte(Farbe.PIK, Kartenwert.KOENIG, 1); // 4  → Gesamt: 36

        Stich stich1 = niedrigerStich(SpielerPosition.WEST);
        Stich stich2 = niedrigerStich(SpielerPosition.WEST);

        Spiel nachStich = spieleViertaKarteImStich(
            mitPflicht, Spieltyp.NORMALSPIEL,
            SpielerPosition.WEST, westKarte, nordKarte, ostKarte,
            SpielerPosition.SUED, suedKarte,
            List.of(stich1, stich2)
        );

        assertTrue(nachStich.pflichtansageAusstehend().isEmpty(),
            "Ab Stich 3 darf kein Pflichtansage-Block ausgeloest werden.");
    }

    @Test
    void spieleKarteSetzt_KeinePflichtansageBeiMaximal30Augen() {
        // Wichtig: Die Grenze ist STRIKT groesser als 30 — ein Stich mit genau 30 Augen loest keinen Block aus.
        Karte westKarte = new Karte(Farbe.PIK, Kartenwert.AS, 1);     // 11
        Karte nordKarte = new Karte(Farbe.PIK, Kartenwert.AS, 2);     // 11
        Karte ostKarte  = new Karte(Farbe.PIK, Kartenwert.KOENIG, 1); // 4
        Karte suedKarte = new Karte(Farbe.PIK, Kartenwert.KOENIG, 2); // 4  → Gesamt: 30

        Spiel nachStich = spieleViertaKarteImStich(
            mitPflicht, Spieltyp.NORMALSPIEL,
            SpielerPosition.WEST, westKarte, nordKarte, ostKarte,
            SpielerPosition.SUED, suedKarte
        );

        assertTrue(nachStich.pflichtansageAusstehend().isEmpty(),
            "Stich mit genau 30 Augen darf keinen Pflichtansage-Block ausloesen (Bedingung: > 30).");
    }

    // --- Solo-Ausschluss ---

    @Test
    void spieleKarteSetzt_KeinePflichtansageBeiSolo() {
        // Wichtig: Soli sind von der Dreissig-Augen-Pflicht ausgenommen — nur NORMALSPIEL und HOCHZEIT.
        Karte westKarte = new Karte(Farbe.PIK, Kartenwert.AS, 1);
        Karte nordKarte = new Karte(Farbe.PIK, Kartenwert.AS, 2);
        Karte ostKarte  = new Karte(Farbe.PIK, Kartenwert.ZEHN, 1);
        Karte suedKarte = new Karte(Farbe.PIK, Kartenwert.KOENIG, 1);

        Spiel nachStich = spieleViertaKarteImStich(
            mitPflicht, Spieltyp.SOLO_DAME,
            SpielerPosition.WEST, westKarte, nordKarte, ostKarte,
            SpielerPosition.SUED, suedKarte
        );

        assertTrue(nachStich.pflichtansageAusstehend().isEmpty(),
            "Bei einem Solo darf kein Pflichtansage-Block ausgeloest werden.");
    }

    // --- Deaktivierung ---

    @Test
    void spieleKarteSetzt_KeinePflichtansageWennRegelDeaktiviert() {
        // Wichtig: Wenn dreissigAugenPflichtAktiv = false, darf kein Block entstehen.
        Karte westKarte = new Karte(Farbe.PIK, Kartenwert.AS, 1);
        Karte nordKarte = new Karte(Farbe.PIK, Kartenwert.AS, 2);
        Karte ostKarte  = new Karte(Farbe.PIK, Kartenwert.ZEHN, 1);
        Karte suedKarte = new Karte(Farbe.PIK, Kartenwert.KOENIG, 1);

        Spiel nachStich = spieleViertaKarteImStich(
            ohnePflicht, Spieltyp.NORMALSPIEL,
            SpielerPosition.WEST, westKarte, nordKarte, ostKarte,
            SpielerPosition.SUED, suedKarte
        );

        assertTrue(nachStich.pflichtansageAusstehend().isEmpty(),
            "Mit deaktivierter Regel darf kein Pflichtansage-Block gesetzt werden.");
    }

    // --- Blockierung ---

    @Test
    void spieleKarteWirftWennPflichtansageAusstehend() {
        // Wichtig: Ein ausstehender Pflichtansage-Block muss spieleKarte() mit IllegalStateException abbrechen.
        // Ohne diesen Test koennte die Blockierungslogik still wegfallen.
        Karte folgeKarte = new Karte(Farbe.PIK, Kartenwert.NEUN, 1);
        Map<SpielerPosition, Hand> haende = Map.of(SpielerPosition.WEST, new Hand(List.of(folgeKarte)));
        Stich naechsterStich = Stich.neu(SpielerPosition.WEST);

        Spiel geblockt = spielMitPflichtansageAusstehend(
            Partei.KONTRA, haende, naechsterStich, mitPflicht
        );

        assertThrows(IllegalStateException.class,
            () -> geblockt.spieleKarte(SpielerPosition.WEST, folgeKarte),
            "spieleKarte() muss bei ausstehender Pflichtansage eine IllegalStateException werfen.");
    }

    @Test
    void spieleKarteErlaubtNachPflichtansage() {
        // Wichtig: Nach der Grundansage muss der Block aufgehoben sein — spieleKarte() muss erlaubt sein.
        Karte folgeKarte = new Karte(Farbe.PIK, Kartenwert.NEUN, 1);
        Map<SpielerPosition, Hand> haende = Map.of(SpielerPosition.WEST, new Hand(List.of(folgeKarte)));
        Stich naechsterStich = Stich.neu(SpielerPosition.WEST);

        Spiel geblockt = spielMitPflichtansageAusstehend(
            Partei.KONTRA, haende, naechsterStich, mitPflicht
        );

        Spiel nachAnsage = geblockt.sageAn(SpielerPosition.WEST, Ansage.KONTRA);

        assertTrue(nachAnsage.pflichtansageAusstehend().isEmpty(),
            "Nach der Grundansage darf kein Pflichtansage-Block mehr bestehen.");
        assertDoesNotThrow(
            () -> nachAnsage.spieleKarte(SpielerPosition.WEST, folgeKarte),
            "Nach der Grundansage muss spieleKarte() erlaubt sein.");
    }

    // --- Mindestkartenanzahl-Bypass ---

    @Test
    void kannAnsagenIgnoriertMindestkartenBeiPflichtansage() {
        // Wichtig: Die normale Kartenanzahl-Grenze (11 Karten fuer Re/Kontra) muss
        // bei einer Pflichtansage ignoriert werden — sonst ist die Regel unerfuellbar
        // wenn das Zeitfenster schon abgelaufen ist.
        // Mit 5 Karten wuerde RE normalerweise abgelehnt.
        List<Karte> wenigeKarten = List.of(
            new Karte(Farbe.PIK, Kartenwert.NEUN, 1),
            new Karte(Farbe.PIK, Kartenwert.NEUN, 2),
            new Karte(Farbe.PIK, Kartenwert.KOENIG, 1),
            new Karte(Farbe.PIK, Kartenwert.KOENIG, 2),
            new Karte(Farbe.PIK, Kartenwert.AS, 1)
        );
        Map<SpielerPosition, Hand> haende = Map.of(SpielerPosition.SUED, new Hand(wenigeKarten));
        Stich naechsterStich = Stich.neu(SpielerPosition.SUED);

        Spiel geblockt = spielMitPflichtansageAusstehend(
            Partei.RE, haende, naechsterStich, mitPflicht
        );

        assertTrue(geblockt.kannAnsagen(SpielerPosition.SUED, Ansage.RE),
            "Bei ausstehender Pflichtansage muss kannAnsagen(RE) auch mit weniger als 11 Karten true liefern.");

        // Aber KONTRA darf SUED (RE-Spieler) nicht ansagen
        assertFalse(geblockt.kannAnsagen(SpielerPosition.SUED, Ansage.KONTRA),
            "SUED (RE-Partei) darf keine KONTRA-Ansage machen, auch nicht als Pflichtansage.");
    }

    // --- Hilfsmethoden ---

    /**
     * Spielt die vierte Karte in einem laufenden Stich (3 Karten bereits gespielt).
     * WEST ist Aufspieler, SUED ist letzter Spieler.
     * Parteien: SUED+NORD=RE, WEST+OST=KONTRA (ausser bei Solo).
     */
    private Spiel spieleViertaKarteImStich(
        Spielregeln regeln,
        Spieltyp spieltyp,
        SpielerPosition aufspieler,
        Karte karte1, Karte karte2, Karte karte3,
        SpielerPosition vierterSpieler,
        Karte karte4
    ) {
        return spieleViertaKarteImStich(regeln, spieltyp, aufspieler, karte1, karte2, karte3,
            vierterSpieler, karte4, List.of());
    }

    private Spiel spieleViertaKarteImStich(
        Spielregeln regeln,
        Spieltyp spieltyp,
        SpielerPosition aufspieler,
        Karte karte1, Karte karte2, Karte karte3,
        SpielerPosition vierterSpieler,
        Karte karte4,
        List<Stich> bereitsAbgeschlosseneStiche
    ) {
        SpielerPosition spieler2 = aufspieler.naechsteImUhrzeigersinn();
        SpielerPosition spieler3 = spieler2.naechsteImUhrzeigersinn();

        Stich laufenderStich = Stich.ausPersistiertemStand(aufspieler, List.of(
            new GespielteKarte(aufspieler, karte1, 1),
            new GespielteKarte(spieler2,   karte2, 2),
            new GespielteKarte(spieler3,   karte3, 3)
        ));

        Map<SpielerPosition, Hand> haende = new EnumMap<>(SpielerPosition.class);
        haende.put(vierterSpieler, new Hand(List.of(karte4)));

        List<Karte> alleKarten = new java.util.ArrayList<>();
        alleKarten.add(karte1);
        alleKarten.add(karte2);
        alleKarten.add(karte3);
        alleKarten.add(karte4);
        bereitsAbgeschlosseneStiche.forEach(stich ->
            stich.gespielteKarten().forEach(gk -> alleKarten.add(gk.karte()))
        );
        // Fuege Dummy-Karten hinzu, damit kartenProSpieler() > abgeschlosseneStiche.size() ist
        // und das Spiel nach dem Stich nicht sofort in die AUSWERTUNG geht, sondern STICHPHASE bleibt.
        int zielKarten = (bereitsAbgeschlosseneStiche.size() + 2) * 4;
        for (int i = alleKarten.size() + 1; i <= zielKarten; i++) {
            alleKarten.add(new Karte(Farbe.KARO, Kartenwert.NEUN, i));
        }

        Parteien parteien = spieltyp == Spieltyp.NORMALSPIEL || spieltyp == Spieltyp.HOCHZEIT
            ? normalspielParteien()
            : Parteien.ausSolo(SpielerPosition.SUED);

        return Spiel.ausPersistiertemStand(
            regeln,
            Kartendeck.ausKarten(alleKarten),
            spieltyp,
            SpielerPosition.SUED,
            new Spielphase.Stichphase(laufenderStich, Set.of(), null),
            haende,
            List.of(),
            parteien,
            Ansagen.leer(),
            bereitsAbgeschlosseneStiche,
            null,
            false,
            null
        ).spieleKarte(vierterSpieler, karte4).neuerStand();
    }

    /**
     * Erstellt ein Spiel in STICHPHASE mit vorgesetzter Pflichtansage fuer eine Partei.
     */
    private Spiel spielMitPflichtansageAusstehend(
        Partei partei,
        Map<SpielerPosition, Hand> haende,
        Stich aktuellerStich,
        Spielregeln regeln
    ) {
        List<Karte> alleKarten = haende.values().stream()
            .flatMap(h -> h.karten().stream())
            .toList();
        return Spiel.ausPersistiertemStand(
            regeln,
            Kartendeck.ausKarten(alleKarten),
            Spieltyp.NORMALSPIEL,
            SpielerPosition.SUED,
            new Spielphase.Stichphase(aktuellerStich, Set.of(partei), null),
            haende,
            List.of(),
            normalspielParteien(),
            Ansagen.leer(),
            List.of(),
            null,
            false,
            null
        );
    }

    /** Erstellt einen Stich mit wenigen Augen (alle NEUN = 0 Augen). */
    private Stich niedrigerStich(SpielerPosition aufspieler) {
        SpielerPosition sp2 = aufspieler.naechsteImUhrzeigersinn();
        SpielerPosition sp3 = sp2.naechsteImUhrzeigersinn();
        SpielerPosition sp4 = sp3.naechsteImUhrzeigersinn();
        return Stich.ausPersistiertemStand(aufspieler, List.of(
            new GespielteKarte(aufspieler, new Karte(Farbe.KARO, Kartenwert.NEUN, 1), 1),
            new GespielteKarte(sp2,        new Karte(Farbe.KARO, Kartenwert.NEUN, 2), 2),
            new GespielteKarte(sp3,        new Karte(Farbe.KARO, Kartenwert.KOENIG, 1), 3),
            new GespielteKarte(sp4,        new Karte(Farbe.KARO, Kartenwert.KOENIG, 2), 4)
        ));
    }

    /** Normalspiel-Parteien: SUED+NORD=RE, WEST+OST=KONTRA. */
    private Parteien normalspielParteien() {
        EnumMap<SpielerPosition, Partei> map = new EnumMap<>(SpielerPosition.class);
        map.put(SpielerPosition.SUED, Partei.RE);
        map.put(SpielerPosition.NORD, Partei.RE);
        map.put(SpielerPosition.WEST, Partei.KONTRA);
        map.put(SpielerPosition.OST,  Partei.KONTRA);
        return Parteien.ausParteiMap(map);
    }
}
