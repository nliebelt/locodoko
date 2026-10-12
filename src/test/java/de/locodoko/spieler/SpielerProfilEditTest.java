package de.locodoko.spieler;

import tools.jackson.databind.ObjectMapper;
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

import java.util.UUID;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class SpielerProfilEditTest {

    @Autowired
    private WebApplicationContext wac;

    @Autowired
    private ObjectMapper objectMapper;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    /**
     * Gueltige Aenderung von Anzeigename und Avatar-Farbe liefert 200 und den aktualisierten Wert.
     * Stellt sicher dass der Happy-Path tatsaechlich persistiert und zurueckgegeben wird.
     */
    @Test
    void gueltigeProfilAenderung_gibt200() throws Exception {
        MvcResult registrierung = registriereSpieler("profileditmain", "sicheresPasswort123");
        UUID spielerId = extrahiereSpielerId(registrierung);
        MockHttpSession session = (MockHttpSession) registrierung.getRequest().getSession();

        mockMvc.perform(put("/api/spieler/{id}/profil", spielerId)
                .session(session)
                .contentType(APPLICATION_JSON)
                .content("{\"anzeigeName\":\"MaxMuster\",\"avatarFarbe\":\"#2a9d8f\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.anzeigeName").value("MaxMuster"))
            .andExpect(jsonPath("$.avatarFarbe").value("#2a9d8f"));
    }

    /**
     * Anzeigename mit weniger als 2 Zeichen wird mit 400 abgewiesen.
     * Stellt sicher dass setzeAnzeigeName() IllegalArgumentException korrekt als 400 propagiert.
     */
    @Test
    void anzeigenameZuKurz_gibt400() throws Exception {
        MvcResult registrierung = registriereSpieler("profilEditKurz", "sicheresPasswort123");
        UUID spielerId = extrahiereSpielerId(registrierung);
        MockHttpSession session = (MockHttpSession) registrierung.getRequest().getSession();

        mockMvc.perform(put("/api/spieler/{id}/profil", spielerId)
                .session(session)
                .contentType(APPLICATION_JSON)
                .content("{\"anzeigeName\":\"X\"}"))
            .andExpect(status().isBadRequest());
    }

    /**
     * Ungueltige Avatar-Farbe (kein #rrggbb-Format) wird mit 400 abgewiesen.
     * Stellt sicher dass setzeAvatarFarbe() IllegalArgumentException korrekt als 400 propagiert.
     */
    @Test
    void ungueltigeAvatarFarbe_gibt400() throws Exception {
        MvcResult registrierung = registriereSpieler("profilEditFarbe", "sicheresPasswort123");
        UUID spielerId = extrahiereSpielerId(registrierung);
        MockHttpSession session = (MockHttpSession) registrierung.getRequest().getSession();

        mockMvc.perform(put("/api/spieler/{id}/profil", spielerId)
                .session(session)
                .contentType(APPLICATION_JSON)
                .content("{\"avatarFarbe\":\"rot\"}"))
            .andExpect(status().isBadRequest());
    }

    /**
     * Fremdes Profil aendern wird mit 403 abgewiesen.
     * Stellt sicher dass der Identitaets-Check den Edit-Pfad auch bei validen Eingaben sperrt.
     */
    @Test
    void fremdesProfilAendern_gibt403() throws Exception {
        MvcResult spielerA = registriereSpieler("profilEditAngreifer", "sicheresPasswort123");
        MvcResult spielerB = registriereSpieler("profilEditOpfer", "sicheresPasswort123");

        UUID spielerBId = extrahiereSpielerId(spielerB);
        MockHttpSession sessionA = (MockHttpSession) spielerA.getRequest().getSession();

        mockMvc.perform(put("/api/spieler/{id}/profil", spielerBId)
                .session(sessionA)
                .contentType(APPLICATION_JSON)
                .content("{\"anzeigeName\":\"Gehackt\"}"))
            .andExpect(status().isForbidden());
    }

    private MvcResult registriereSpieler(String benutzername, String passwort) throws Exception {
        record RegistrierungsAnfrage(String benutzername, String passwort, String email) {}
        return mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new RegistrierungsAnfrage(benutzername, passwort, null))))
            .andExpect(status().isCreated())
            .andReturn();
    }

    private UUID extrahiereSpielerId(MvcResult result) throws Exception {
        String body = result.getResponse().getContentAsString();
        return objectMapper.readValue(body, AuthentifizierungsAntwort.class).spielerId();
    }
}
