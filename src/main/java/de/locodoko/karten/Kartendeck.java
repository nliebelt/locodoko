package de.locodoko.karten;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Random;

/**
 * Das vollstaendige Kartendeck fuer ein Doppelkopf-Spiel.
 *
 * <p>Ein Standard-Doppelkopf-Deck enthaelt 48 Karten (je 2 Exemplare der 24 Karten
 * aus Farbe x Wert ohne Neunen) bzw. 40 Karten in der "Ohne Neunen"-Variante.
 * Das Deck ist unveraenderlich; Mischen und Austeilen erzeugen jeweils neue Instanzen.
 * {@link #anVierSpielerAusteilen()} verteilt die Karten gleichmaessig an vier Spieler
 * im Uhrzeigersinn (Sued, West, Nord, Ost).</p>
 */
public final class Kartendeck {

    private final List<Karte> karten;

    private Kartendeck(Collection<Karte> karten) {
        this.karten = List.copyOf(karten);
    }

    public static Kartendeck neu(Spielregeln spielregeln) {
        List<Karte> karten = new ArrayList<>();
        for (Farbe farbe : Farbe.values()) {
            for (Kartenwert wert : Kartenwert.values()) {
                if (spielregeln.ohneNeunen() && wert == Kartenwert.NEUN) {
                    continue;
                }
                karten.add(new Karte(farbe, wert, 1));
                karten.add(new Karte(farbe, wert, 2));
            }
        }
        return new Kartendeck(karten);
    }

    public static Kartendeck ausKarten(Collection<Karte> karten) {
        return new Kartendeck(karten);
    }

    public Kartendeck gemischt() {
        return gemischt(new SecureRandom());
    }

    public Kartendeck gemischt(Random zufall) {
        Objects.requireNonNull(zufall, "zufall darf nicht null sein");
        List<Karte> kopie = new ArrayList<>(karten);
        Collections.shuffle(kopie, zufall);
        return new Kartendeck(kopie);
    }

    public List<Karte> karten() {
        return karten;
    }

    public int gesamtaugen() {
        return karten.stream().mapToInt(Karte::augen).sum();
    }

    /**
     * Teilt die Karten gleichmaessig an vier Spieler aus.
     *
     * <p>Gibt eine Liste von vier {@link Hand}-Instanzen zurueck, verteilt im
     * Uhrzeigersinn (Index 0 = Sued, 1 = West, 2 = Nord, 3 = Ost).</p>
     */
    public List<Hand> anVierSpielerAusteilen() {
        if (karten.size() % 4 != 0) {
            throw new IllegalStateException("Kartenzahl muss durch vier teilbar sein");
        }
        List<List<Karte>> verteilung = new ArrayList<>(4);
        for (int i = 0; i < 4; i++) {
            verteilung.add(new ArrayList<>());
        }
        for (int index = 0; index < karten.size(); index++) {
            verteilung.get(index % 4).add(karten.get(index));
        }
        return verteilung.stream().map(Hand::new).toList();
    }
}
