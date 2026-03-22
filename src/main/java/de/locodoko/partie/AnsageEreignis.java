package de.locodoko.partie;

import de.locodoko.karten.SpielerPosition;

import java.util.Objects;

/**
 * Ein einzelnes Ansage-Ereignis: Welcher Spieler welche Ansage/Absage getaetigt hat.
 *
 * <p>Wird in der geordneten Ereignisliste von {@link Ansagen} gespeichert und ist
 * Bestandteil des oeffentlichen Partie-Snapshots, damit alle Spieler die bisherigen
 * Ansagen einsehen koennen.</p>
 *
 * @param spieler  Position des Spielers, der angesagt hat
 * @param ansage   die getaetigte Ansage oder Absage
 */
public record AnsageEreignis(SpielerPosition spieler, Ansage ansage) {

    public AnsageEreignis {
        Objects.requireNonNull(spieler, "spieler darf nicht null sein");
        Objects.requireNonNull(ansage, "ansage darf nicht null sein");
    }
}
