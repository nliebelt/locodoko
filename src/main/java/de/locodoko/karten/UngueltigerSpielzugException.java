package de.locodoko.karten;

/**
 * Wird geworfen, wenn ein Spielzug gegen die Doppelkopf-Regeln verstoesst.
 *
 * <p>Typische Gruende: Bedienpflicht verletzt, Karte nicht auf der Hand, falscher Spieler
 * am Zug oder Stich bereits vollstaendig. Diese Exception ist eine unchecked RuntimeException,
 * da Regelverstoesse immer auf fehlerhafte Client-Eingaben hinweisen und serverseitig
 * als 400 Bad Request zurueckgegeben werden.</p>
 */
public class UngueltigerSpielzugException extends RuntimeException {

    public UngueltigerSpielzugException(String nachricht) {
        super(nachricht);
    }
}
