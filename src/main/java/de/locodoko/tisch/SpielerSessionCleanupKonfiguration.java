package de.locodoko.tisch;

import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import org.springframework.boot.web.servlet.ServletListenerRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registriert einen {@link HttpSessionListener} beim eingebetteten Servlet-Container,
 * der nach dem Ablauf von HTTP-Sessions den {@link SpielerSessionCleanupService} auslöst.
 *
 * <p>Spring-Beans können nicht direkt als Servlet-Listener registriert werden.
 * Die {@link ServletListenerRegistrationBean} ist der korrekte Weg, damit Spring
 * den {@code SpielerSessionCleanupService} verwaltet und der Listener auf ihn zugreifen kann.
 */
@Configuration
public class SpielerSessionCleanupKonfiguration {

    /**
     * Registriert den Session-Ablauf-Listener beim eingebetteten Servlet-Container.
     *
     * @param cleanupService Spring-Bean für die eigentliche Bereinigungslogik
     * @return registrierter Listener für Session-Ereignisse
     */
    @Bean
    public ServletListenerRegistrationBean<HttpSessionListener> sitzungsAbschlussListener(
            SpielerSessionCleanupService cleanupService
    ) {
        return new ServletListenerRegistrationBean<>(new HttpSessionListener() {
            @Override
            public void sessionDestroyed(HttpSessionEvent se) {
                cleanupService.bereinige(se.getSession().getId());
            }
        });
    }
}
