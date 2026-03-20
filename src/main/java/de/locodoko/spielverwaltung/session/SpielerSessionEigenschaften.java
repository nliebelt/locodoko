package de.locodoko.spielverwaltung.session;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

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
