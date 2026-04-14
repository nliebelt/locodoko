package de.locodoko.partie;


import java.util.Objects;
import java.util.Optional;

/**
 * Zustand der laufenden Hochzeit-Aufklaerung.
 *
 * <p>Bei einer Hochzeit hat der Hochzeit-Spieler beide Kreuz-Damen und sucht einen Partner.
 * In den ersten drei Klaerungsstichen wird der erste fremde Stichgewinner als Re-Partner
 * aufgenommen. Gewinnt niemand anderes die ersten drei Stiche, wird die Hochzeit ein
 * stilles Solo (Hochzeit-Spieler allein gegen drei).</p>
 *
 * @param hochzeitSpieler  der Spieler mit beiden Kreuz-Damen
 * @param geklaerteStiche  Anzahl der bisherigen Klaerungsstiche (0–3)
 * @param partnerSpieler   der gefundene Partner, oder {@code null} waehrend der Suche
 * @param stillesSolo      {@code true}, wenn die Hochzeit in ein stilles Solo umgewandelt wurde
 */
public record HochzeitStatus(
    SpielerPosition hochzeitSpieler,
    int geklaerteStiche,
    SpielerPosition partnerSpieler,
    boolean stillesSolo
) {

    public HochzeitStatus {
        Objects.requireNonNull(hochzeitSpieler, "hochzeitSpieler darf nicht null sein");
        if (geklaerteStiche < 0 || geklaerteStiche > 3) {
            throw new IllegalArgumentException("geklaerteStiche muss zwischen 0 und 3 liegen");
        }
        if (stillesSolo && partnerSpieler != null) {
            throw new IllegalArgumentException("Stilles Solo und Partner schliessen sich gegenseitig aus");
        }
    }

    public static HochzeitStatus gestartet(SpielerPosition hochzeitSpieler) {
        return new HochzeitStatus(hochzeitSpieler, 0, null, false);
    }

    public boolean suchtPartner() {
        return partnerSpieler == null && !stillesSolo;
    }

    public Optional<SpielerPosition> partner() {
        return Optional.ofNullable(partnerSpieler);
    }

    public HochzeitStatus mitGeklaertemStich(SpielerPosition stichGewinner) {
        Objects.requireNonNull(stichGewinner, "stichGewinner darf nicht null sein");
        if (!suchtPartner()) {
            return this;
        }
        int neueGeklaerteStiche = geklaerteStiche + 1;
        if (stichGewinner != hochzeitSpieler) {
            return new HochzeitStatus(hochzeitSpieler, neueGeklaerteStiche, stichGewinner, false);
        }
        if (neueGeklaerteStiche >= 3) {
            return new HochzeitStatus(hochzeitSpieler, neueGeklaerteStiche, null, true);
        }
        return new HochzeitStatus(hochzeitSpieler, neueGeklaerteStiche, null, false);
    }
}
