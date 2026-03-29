package de.locodoko.session;

import tools.jackson.databind.ObjectMapper;
import de.locodoko.session.SpielerEntity;
import de.locodoko.session.SpielerRepository;
import de.locodoko.lobby.TischEntity;
import de.locodoko.lobby.TischRepository;
import de.locodoko.lobby.TischkonfigurationEmbeddable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class SpielerSessionControllerTest {

    @Autowired
    private WebApplicationContext wac;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SpielerRepository spielerRepository;

    @Autowired
    private TischRepository tischRepository;

    @Test
    void erstelltNeueSpielerSessionUndSpeichertDenSpielerServerseitig() throws Exception {
        MvcResult ergebnis = mockMvc.perform(post("/api/spieler/session")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SpielerNameAnfrage("  Ada  "))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Ada"))
            .andExpect(jsonPath("$.istKi").value(false))
            .andReturn();

        MockHttpSession session = (MockHttpSession) ergebnis.getRequest().getSession(false);
        assertNotNull(session,
            "Nach der Registrierung muss eine HttpSession existieren, damit der Spieler beim naechsten Aufruf wiedererkannt werden kann.");
        assertEquals(3600, session.getMaxInactiveInterval(),
            "Neue Spieler-Sessions muessen standardmaessig 60 Minuten Inaktivitaet erlauben, damit Wiedererkennung ohne Login funktioniert.");
        assertTrue(spielerRepository.findBySessionId(session.getId()).isPresent(),
            "Die Session-ID muss serverseitig auf einen Spieler zeigen, weil nur so derselbe Mensch spaeter ohne Login erkannt wird.");
    }

    @Test
    void erkenntWiederkehrendenSpielerUeberDieselbeSessionAutomatisch() throws Exception {
        MvcResult anlage = mockMvc.perform(post("/api/spieler/session")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SpielerNameAnfrage("Ada"))))
            .andExpect(status().isCreated())
            .andReturn();

        MockHttpSession session = (MockHttpSession) anlage.getRequest().getSession(false);

        mockMvc.perform(get("/api/spieler/session").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Ada"))
            .andExpect(jsonPath("$.istKi").value(false));
    }

    @Test
    void lehntSessionOhneServerseitigenSpielereintragAb() throws Exception {
        mockMvc.perform(get("/api/spieler/session").session(new MockHttpSession()))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.fehlerCode").value("SPIELER_SESSION_UNGUELTIG"));
    }

    @Test
    void erlaubtNamensaenderungSolangeDerSpielerKeinemTischZugeordnetIst() throws Exception {
        MvcResult anlage = mockMvc.perform(post("/api/spieler/session")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SpielerNameAnfrage("Ada"))))
            .andExpect(status().isCreated())
            .andReturn();

        MockHttpSession session = (MockHttpSession) anlage.getRequest().getSession(false);

        mockMvc.perform(put("/api/spieler/session")
                .session(session)
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SpielerNameAnfrage("Ada Lovelace"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Ada Lovelace"));
    }

    @Test
    void liefertNullAktiveTischIdWennSpielerAnKeinemTischSitzt() throws Exception {
        // Wichtig: Das Frontend braucht aktiverTischId um nach Tab-Reload eine Session-Recovery
        // durchfuehren zu koennen. Ohne diese Info wuerde der Spieler bei jedem Reload zurueck
        // in die Lobby geschickt, obwohl er bereits in einem laufenden Spiel sitzt.
        MvcResult anlage = mockMvc.perform(post("/api/spieler/session")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SpielerNameAnfrage("SitzungsTest"))))
            .andExpect(status().isCreated())
            .andReturn();
        MockHttpSession session = (MockHttpSession) anlage.getRequest().getSession(false);

        mockMvc.perform(get("/api/spieler/session").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.aktiverTischId").isEmpty());
    }

    @Test
    @Transactional
    void liefertAktiveTischIdWennSpielerAnEinemTischSitzt() throws Exception {
        // Wichtig: Wenn aktiverTischId gesetzt ist, leitet das Frontend nach Tab-Reload
        // direkt zur Tischansicht weiter statt zur Lobby — das ist die Session-Recovery-Grundlage.
        MvcResult anlage = mockMvc.perform(post("/api/spieler/session")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SpielerNameAnfrage("TischSpieler"))))
            .andExpect(status().isCreated())
            .andReturn();
        MockHttpSession session = (MockHttpSession) anlage.getRequest().getSession(false);
        SpielerEntity spieler = spielerRepository.findBySessionId(session.getId()).orElseThrow();

        TischEntity tisch = TischEntity.neu("SessionRecoveryTisch", spieler, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(spieler);
        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

        mockMvc.perform(get("/api/spieler/session").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.aktiverTischId").value(gespeichert.id().toString()));
    }

    @Test
    @Transactional
    void verbietetNamensaenderungSobaldDerSpielerAnEinemTischSitzt() throws Exception {
        MvcResult anlage = mockMvc.perform(post("/api/spieler/session")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SpielerNameAnfrage("Ada"))))
            .andExpect(status().isCreated())
            .andReturn();

        MockHttpSession session = (MockHttpSession) anlage.getRequest().getSession(false);
        SpielerEntity spieler = spielerRepository.findBySessionId(session.getId()).orElseThrow();

        TischEntity tisch = TischEntity.neu("Testtisch", spieler, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(spieler);
        tischRepository.saveAndFlush(tisch);

        mockMvc.perform(put("/api/spieler/session")
                .session(session)
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SpielerNameAnfrage("Ada Neu"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.fehlerCode").value("SPIELER_NAME_AENDERUNG_NICHT_ERLAUBT"));
    }
}
