package de.locodoko.spielverwaltung.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.locodoko.spielverwaltung.persistenz.SpielerEntity;
import de.locodoko.spielverwaltung.persistenz.SpielerRepository;
import de.locodoko.spielverwaltung.persistenz.TischEntity;
import de.locodoko.spielverwaltung.persistenz.TischRepository;
import de.locodoko.spielverwaltung.persistenz.TischkonfigurationEmbeddable;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

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
@AutoConfigureMockMvc
class SpielerSessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

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
