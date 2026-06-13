package de.locodoko.spieler;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitingFilterTest {

    private static final FilterChain LEER = (req, res) -> {};

    private RateLimitingFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitingFilter();
    }

    private MockHttpServletResponse sendePost(String pfad, String ip) throws Exception {
        var request = new MockHttpServletRequest("POST", pfad);
        request.setRemoteAddr(ip);
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, LEER);
        return response;
    }

    /** Ohne diesen Test könnte ein Refactor den Schwellenwert versehentlich auf 0 setzen
     *  oder den Check ganz entfernen. */
    @Test
    void loginRateLimitNachMaxVersuchenGibt429() throws Exception {
        for (int i = 0; i < 10; i++) {
            assertThat(sendePost("/api/auth/login", "1.2.3.4").getStatus()).isEqualTo(200);
        }
        assertThat(sendePost("/api/auth/login", "1.2.3.4").getStatus()).isEqualTo(429);
    }

    /** GET-Anfragen dürfen niemals blockiert werden — sonst würden Browserseitige Vorprüfungen
     *  (CORS, Preflight) oder Healthchecks fälschlich mit 429 beantwortet. */
    @Test
    void getAnfragenWerdenNichtLimitiert() throws Exception {
        for (int i = 0; i <= 15; i++) {
            var request = new MockHttpServletRequest("GET", "/api/auth/login");
            request.setRemoteAddr("1.2.3.5");
            var response = new MockHttpServletResponse();
            filter.doFilter(request, response, LEER);
            assertThat(response.getStatus()).isNotEqualTo(429);
        }
    }

    /** Ohne pro-IP-Trennung würde der Zähler global laufen — ein einzelner Client
     *  könnte alle anderen Nutzer aussperren. */
    @Test
    void verschiedeneIpsHabenGetrennteLimits() throws Exception {
        for (int i = 0; i < 10; i++) {
            sendePost("/api/auth/login", "10.0.0.1");
        }
        // IP 1 ist jetzt gesperrt
        assertThat(sendePost("/api/auth/login", "10.0.0.1").getStatus()).isEqualTo(429);
        // IP 2 hat ein eigenes Limit und darf noch 10 Anfragen senden
        for (int i = 0; i < 10; i++) {
            assertThat(sendePost("/api/auth/login", "10.0.0.2").getStatus()).isEqualTo(200);
        }
    }

    /** Nicht konfigurierte Pfade dürfen nicht fälschlich blockiert werden. */
    @Test
    void unbekannterPfadWirdNichtLimitiert() throws Exception {
        for (int i = 0; i < 50; i++) {
            assertThat(sendePost("/api/spieler/profil", "1.2.3.6").getStatus()).isEqualTo(200);
        }
    }

    /** Registrierungs-Limit (10/10min) schützt vor automatisierten Account-Erstellungen. */
    @Test
    void registerRateLimitNachMaxVersuchenGibt429() throws Exception {
        for (int i = 0; i < 10; i++) {
            assertThat(sendePost("/api/auth/register", "1.2.3.7").getStatus()).isEqualTo(200);
        }
        assertThat(sendePost("/api/auth/register", "1.2.3.7").getStatus()).isEqualTo(429);
    }

    /** Passwort-Reset-Limit (5/10min) verhindert Email-Spam an beliebige Adressen. */
    @Test
    void passwortResetRateLimitNachMaxVersuchenGibt429() throws Exception {
        for (int i = 0; i < 5; i++) {
            assertThat(sendePost("/api/auth/passwort-reset-anfragen", "1.2.3.8").getStatus()).isEqualTo(200);
        }
        assertThat(sendePost("/api/auth/passwort-reset-anfragen", "1.2.3.8").getStatus()).isEqualTo(429);
    }

    /** Bugreport-Limit (5/10min) verhindert Log-Flooding über die Report-API. */
    @Test
    void bugreportRateLimitNachMaxVersuchenGibt429() throws Exception {
        for (int i = 0; i < 5; i++) {
            assertThat(sendePost("/api/bugreport", "1.2.3.9").getStatus()).isEqualTo(200);
        }
        assertThat(sendePost("/api/bugreport", "1.2.3.9").getStatus()).isEqualTo(429);
    }

    /** Debug-Log-Limit (30/min) hat einen höheren Schwellenwert als andere Endpunkte —
     *  dieser Test stellt sicher, dass er nicht versehentlich auf 5 oder 10 gesetzt wird. */
    @Test
    void debugLogRateLimitNachMaxVersuchenGibt429() throws Exception {
        for (int i = 0; i < 30; i++) {
            assertThat(sendePost("/api/debug/log", "1.2.3.10").getStatus()).isEqualTo(200);
        }
        assertThat(sendePost("/api/debug/log", "1.2.3.10").getStatus()).isEqualTo(429);
    }

    /** Der Client muss einen maschinenlesbaren Fehlercode und korrekte Content-Type-Angabe
     *  erhalten, damit das Frontend einen sinnvollen Toast anzeigen kann. */
    @Test
    void rateLimitAntwortHatKorrektenJsonBodyUndContentType() throws Exception {
        for (int i = 0; i <= 10; i++) {
            sendePost("/api/auth/login", "1.2.3.11");
        }
        var response = sendePost("/api/auth/login", "1.2.3.11");
        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getContentType()).contains("application/json");
        assertThat(response.getContentAsString()).contains("RATE_LIMIT_UEBERSCHRITTEN");
    }

    /** Ohne periodisches Aufraeumen wuechsen die IP-Maps im oeffentlichen Betrieb unbeschraenkt
     *  (eine Reihe pro jemals gesehener Client-IP) — ein langsames Speicherleck. */
    @Test
    void cleanupEntferntEintraegeMitAbgelaufenemFenster() throws Exception {
        sendePost("/api/auth/login", "1.2.3.12");
        sendePost("/api/bugreport", "1.2.3.13");
        assertThat(filter.anzahlVerfolgterIps()).isEqualTo(2);

        // Login-Fenster (60s) abgelaufen, Bugreport-Fenster (600s) noch nicht.
        filter.entferneAbgelaufeneEintraege(Instant.now().plusSeconds(120));
        assertThat(filter.anzahlVerfolgterIps()).isEqualTo(1);

        // Auch das laengere Bugreport-Fenster ist nun abgelaufen.
        filter.entferneAbgelaufeneEintraege(Instant.now().plusSeconds(700));
        assertThat(filter.anzahlVerfolgterIps()).isZero();
    }

    /** Cleanup darf eine IP mit noch laufendem Fenster nicht entfernen — sonst koennte ein
     *  Angreifer durch Timing das Limit umgehen. */
    @Test
    void cleanupBehaeltEintraegeMitLaufendemFenster() throws Exception {
        sendePost("/api/auth/login", "1.2.3.14");
        filter.entferneAbgelaufeneEintraege(Instant.now().plusSeconds(30));
        assertThat(filter.anzahlVerfolgterIps()).isEqualTo(1);
    }
}
