package de.locodoko.spieler;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class CorrelationIdFilterTest {

    private final CorrelationIdFilter filter = new CorrelationIdFilter();
    private static final FilterChain LEER = (req, res) -> {};

    @AfterEach
    void mdcBereinigen() {
        MDC.clear();
    }

    @Test
    void erzeugtNeueCorrelationIdWennKeinHeaderVorhanden() throws Exception {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, LEER);

        String header = response.getHeader(CorrelationIdFilter.HEADER_NAME);
        assertThat(header).isNotNull().isNotBlank();
        // UUID-Format: 8-4-4-4-12
        assertThat(header).matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }

    @Test
    void uebernimmtVorhandeneCorrelationIdAusRequest() throws Exception {
        String vorhandeneId = "meine-correlation-id-123";
        var request = new MockHttpServletRequest();
        request.addHeader(CorrelationIdFilter.HEADER_NAME, vorhandeneId);
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, LEER);

        assertThat(response.getHeader(CorrelationIdFilter.HEADER_NAME)).isEqualTo(vorhandeneId);
    }

    @Test
    void schreibtCorrelationIdInsMdc() throws Exception {
        String[] capturedId = {null};
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        // MDC-Wert innerhalb der Filter-Kette abgreifen
        FilterChain chain = (req, res) -> capturedId[0] = MDC.get("correlationId");

        filter.doFilter(request, response, chain);

        assertThat(capturedId[0]).isNotNull().isNotBlank();
        assertThat(capturedId[0]).isEqualTo(response.getHeader(CorrelationIdFilter.HEADER_NAME));
    }

    @Test
    void bereingtMdcNachRequestDurchlauf() throws Exception {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, LEER);

        // MDC-Eintrag muss nach dem Filter wieder entfernt sein
        assertThat(MDC.get("correlationId")).isNull();
    }
}
