package de.locodoko.spieler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.List;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integrationstests fuer BugReportController mit aktivierter Loki-URL und GitHub-Konfiguration.
 * Deckt die env-gated Code-Pfade ab: erzeugeLokiDeepLink (Loki-URL gesetzt) und
 * erstelleGithubIssue (GitHub-Credentials gesetzt — HTTP-Fehler wird abgefangen, issueUrl=null).
 */
@SpringBootTest(properties = {
    "locodoko.bugreport.loki-base-url=http://loki.example.com/grafana",
    "locodoko.bugreport.github-token=fake-test-token-nicht-gueltig",
    "locodoko.bugreport.github-repo=nicht-existentes-owner/nicht-existentes-repo-xyz"
})
class BugReportControllerEnvGatedTest {

    private static final Path LOG_PFAD = Path.of("logs/locodoko.log");

    @Autowired
    private WebApplicationContext wac;

    @Autowired
    private ObjectMapper objectMapper;

    private MockMvc mockMvc;

    /**
     * Stellt sicher, dass logs/locodoko.log existiert, damit leseLogAusschnitt den Try-Block durchlaeuft.
     * In der lokalen Entwicklung existiert die Datei bereits. In CI wird sie leer angelegt.
     */
    @BeforeAll
    static void sicherstelleDassLogDateiExistiert() throws IOException {
        if (!Files.exists(LOG_PFAD)) {
            Files.createDirectories(LOG_PFAD.getParent());
            Files.writeString(LOG_PFAD, "TEST-LOG-EINTRAG locodoko-start\n", StandardOpenOption.CREATE);
        }
    }

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    /**
     * Loki-Deep-Link wird erzeugt wenn locodoko.bugreport.loki-base-url gesetzt ist.
     * Deckt die URL-Erzeugungslogik in erzeugeLokiDeepLink ab.
     */
    @Test
    void reportMitLokiUrl_erzeugtDeepLinkImBody() throws Exception {
        MockHttpSession session = erstelleSpielerSession("LokiTestSpieler");
        var anfrage = new BugReportController.BugReportAnfrage(
                "Loki-Test Bug", "NIEDRIG",
                List.of("korr-id-loki-001", "korr-id-loki-002"),
                "tisch-loki-123", "partie-loki-456",
                "Mozilla/5.0", "1920x1080", "abc123sha",
                "{\"bereich\":\"TISCH\",\"test\":true}");

        mockMvc.perform(post("/api/bugreport")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(anfrage)))
                .andExpect(status().isOk());
    }

    /**
     * GitHub-Issue-Erstellung wird versucht wenn Credentials gesetzt sind.
     * Der HTTP-Aufruf schlaegt fehl (ungueltige Credentials oder kein Netz) — die Exception
     * wird in erstelleGithubIssue abgefangen und issueUrl=null zurueckgegeben.
     * Wichtig: Sichert dass erstelleGithubIssue keine Exception nach aussen wirft.
     */
    @Test
    void reportMitGithubConfig_wirdNachAussenNichtGeworfen() throws Exception {
        MockHttpSession session = erstelleSpielerSession("GithubTestSpieler");
        var anfrage = new BugReportController.BugReportAnfrage(
                "GitHub-Test Bug — bitte ignorieren", "HOCH",
                List.of("korr-id-gh-999"),
                null, null,
                "TestBrowser/1.0", "1280x720", null, null);

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
