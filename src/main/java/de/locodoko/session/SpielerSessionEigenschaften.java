package de.locodoko.session;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Konfigurierbare Eigenschaften fuer die Spieler-Session ({@code locodoko.session.*}).
 *
 * <p>Derzeit konfigurierbar: {@code locodoko.session.timeout} (Standard: 60 Minuten).
 * Abgelaufene Sessions werden durch den Session-Cleanup-Service behandelt.</p>
 */
@ConfigurationProperties(prefix = "locodoko.session")
public class SpielerSessionEigenschaften {

    private Duration timeout = Duration.ofMinutes(60);

    public Duration getTimeout() {
        return timeout;
    }

    public void setTimeout(Duration timeout) {
        this.timeout = timeout;
    }
}
