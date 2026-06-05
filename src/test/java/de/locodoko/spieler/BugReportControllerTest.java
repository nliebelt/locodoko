package de.locodoko.spieler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests fuer BugReportController.
 * Wichtig: Auth-Gate sichert, dass kein anonymer Report moeglich ist.
 * Validierung stellt sicher, dass leere Beschreibungen abgelehnt werden.
 */
@SpringBootTest
class BugReportControllerTest {

    @Autowired
    private WebApplicationContext wac;

    @Autowired
    private ObjectMapper objectMapper;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    /** Sichert, dass kein unauthentifizierter Report angenommen wird (Datenschutz). */
    @Test
    void ohneSessionWird401Zurueckgegeben() throws Exception {
        var anfrage = new BugReportController.BugReportAnfrage(
                "Test-Bug", "MITTEL", List.of(), null, null,
                "TestUA", "1280x720", null, null);

        mockMvc.perform(post("/api/bugreport")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(anfrage)))
                .andExpect(status().isUnauthorized());
    }

    /** Validierung: leere Beschreibung wird mit 400 abgelehnt (schlechte Reports verhindern). */
    @Test
    void leereZuBeschreibungWird400Zurueckgegeben() throws Exception {
        MockHttpSession session = erstelleSpielerSession("BugTestSpieler");
        var anfrage = new BugReportController.BugReportAnfrage(
                "", "MITTEL", List.of(), null, null,
                "TestUA", "1280x720", null, null);

        mockMvc.perform(post("/api/bugreport")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(anfrage)))
                .andExpect(status().isBadRequest());
    }

    /** Happy Path: authentifizierter Report ohne GitHub-Config liefert 200 mit issueUrl=null. */
    @Test
    @org.springframework.transaction.annotation.Transactional
    void authentifizierterReportWird200Zurueckgegeben() throws Exception {
        MockHttpSession session = erstelleSpielerSession("BugReporter");
        var anfrage = new BugReportController.BugReportAnfrage(
                "Karte reagiert nicht bei Hochzeit-Annahme", "MITTEL",
                List.of("abc-123"), null, null,
                "Mozilla/5.0 Test", "1280x720", null,
                "{\"bereich\":\"TISCH\"}");

        mockMvc.perform(post("/api/bugreport")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(anfrage)))
                .andExpect(status().isOk());
    }

    private MockHttpSession erstelleSpielerSession(String name) throws Exception {
        MvcResult ergebnis = mockMvc.perform(post("/api/spieler/session")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new SpielerNameAnfrage(name))))
                .andExpect(status().isCreated())
                .andReturn();
        return (MockHttpSession) ergebnis.getRequest().getSession(false);
    }
}
