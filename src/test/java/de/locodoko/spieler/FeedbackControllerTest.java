package de.locodoko.spieler;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests fuer {@link FeedbackController}.
 * Sichert: valides Feedback wird mit 200 angenommen; leerer Text und zu langer Text
 * werden mit 400 abgelehnt (Bean Validation). Kein Webhook konfiguriert im Test.
 */
@SpringBootTest
class FeedbackControllerTest {

    @Autowired
    private WebApplicationContext wac;

    @Autowired
    private ObjectMapper objectMapper;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    @Test
    void validesFeedbackWirdAngenommen() throws Exception {
        var anfrage = new FeedbackController.FeedbackAnfrage("Das Spiel macht Spass!");

        mockMvc.perform(post("/api/feedback")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(anfrage)))
                .andExpect(status().isOk());
    }

    @Test
    void leeresTextFeldWirdAbgelehnt() throws Exception {
        var anfrage = new FeedbackController.FeedbackAnfrage("   ");

        mockMvc.perform(post("/api/feedback")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(anfrage)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void zuLangerTextWirdAbgelehnt() throws Exception {
        var anfrage = new FeedbackController.FeedbackAnfrage("x".repeat(2001));

        mockMvc.perform(post("/api/feedback")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(anfrage)))
                .andExpect(status().isBadRequest());
    }
}
