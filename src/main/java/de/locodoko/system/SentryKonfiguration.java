package de.locodoko.system;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import io.sentry.Sentry;
import io.sentry.logback.SentryAppender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Sentry-Fehlererfassung fuer das Backend.
 *
 * <p>Bewusst ueber das Core-SDK ({@code io.sentry:sentry}) statt der Spring-Boot-Autoconfiguration
 * angebunden: die Autoconfig ist an konkrete Spring-Boot-Versionen gekoppelt, der hier gewaehlte
 * Weg (programmatisches {@link Sentry#init} + manuell angehaengter {@link SentryAppender}) ist
 * davon unabhaengig und robust gegen Boot-Upgrades.</p>
 *
 * <p>Ohne konfigurierte {@code sentry.dsn} (z.B. in Tests und lokaler Entwicklung) ist Sentry ein
 * No-Op — es wird weder initialisiert noch ein Appender angehaengt. Der MDC-Schluessel
 * {@code correlationId} (gesetzt vom {@code CorrelationIdFilter}) wird als Sentry-Tag uebernommen,
 * sodass sich Fehler mit Loki-Logs und In-App-Bugreports verknuepfen lassen.</p>
 */
@Configuration
public class SentryKonfiguration {

    private static final Logger log = LoggerFactory.getLogger(SentryKonfiguration.class);

    /** MDC-Schluessel der Correlation-ID, identisch zu {@code CorrelationIdFilter}. */
    private static final String MDC_CORRELATION_ID = "correlationId";

    public SentryKonfiguration(
            @Value("${sentry.dsn:}") String dsn,
            @Value("${sentry.environment:lokal}") String umgebung) {
        if (dsn == null || dsn.isBlank()) {
            log.info("Sentry deaktiviert: keine sentry.dsn konfiguriert.");
            return;
        }
        Sentry.init(options -> {
            options.setDsn(dsn);
            options.setEnvironment(umgebung);
            options.setSendDefaultPii(false);            // keine personenbezogenen Daten (DSGVO)
            options.setTracesSampleRate(0.0);            // kein Performance-Tracing in M1
            options.addContextTag(MDC_CORRELATION_ID);   // correlationId aus MDC als Sentry-Tag
        });
        haengeLogbackAppenderAn();
        log.info("Sentry aktiviert (Umgebung={}).", umgebung);
    }

    /**
     * Haengt einen {@link SentryAppender} (ab Level ERROR) an den Logback-Root-Logger, sodass
     * geloggte Fehler automatisch als Sentry-Events erfasst werden. Der Appender nutzt den zuvor
     * via {@link Sentry#init} initialisierten globalen Scope.
     */
    private void haengeLogbackAppenderAn() {
        LoggerContext kontext = (LoggerContext) LoggerFactory.getILoggerFactory();
        SentryAppender appender = new SentryAppender();
        appender.setName("SENTRY");
        appender.setContext(kontext);
        appender.setMinimumEventLevel(Level.ERROR);
        appender.start();
        kontext.getLogger(Logger.ROOT_LOGGER_NAME).addAppender(appender);
    }
}
