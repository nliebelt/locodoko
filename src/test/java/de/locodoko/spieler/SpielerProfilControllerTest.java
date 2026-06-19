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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

/**
 * Sicherheitstests fuer SpielerProfilController.
 *
 * <p>Prueft dass Spieler ihr eigenes Profil aendern duerfen (200),
 * fremde Profile nicht aendern koennen (403) und unauthentifizierte
 * Anfragen abgelehnt werden (401).</p>
 */
@SpringBootTest
@Transactional
class SpielerProfilControllerTest {

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
     * Spieler darf sein eigenes Profil aktualisieren.
     * Stellt sicher dass legitime Selbst-Aenderungen nicht blockiert werden.
     */
    @Test
    void eigenesProjilAktualisierenErfolgreich() throws Exception {
        MvcResult registrierung = registriereSpieler("eigenerprofil", "sicheresPasswort123");
        UUID spielerId = extrahiereSpielerId(registrierung);
        MockHttpSession session = (MockHttpSession) registrierung.getRequest().getSession();

        mockMvc.perform(put("/api/spieler/{id}/profil", spielerId)
                .session(session)
                .contentType(APPLICATION_JSON)
                .content("{\"anzeigeName\":\"NeuName\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.anzeigeName").value("NeuName"));
    }

    /**
     * Spieler darf kein fremdes Profil aktualisieren (403).
     * Verhindert dass ein authentifizierter Spieler Daten anderer Spieler ueberschreibt.
     */
    @Test
    void fremdesProfilAktualisierenGibt403() throws Exception {
        MvcResult spielerA = registriereSpieler("spielerA_profil", "sicheresPasswort123");
        MvcResult spielerB = registriereSpieler("spielerB_profil", "sicheresPasswort123");

        UUID spielerBId = extrahiereSpielerId(spielerB);
        MockHttpSession sessionA = (MockHttpSession) spielerA.getRequest().getSession();

        // Spieler A versucht Profil von Spieler B zu aendern
        mockMvc.perform(put("/api/spieler/{id}/profil", spielerBId)
                .session(sessionA)
                .contentType(APPLICATION_JSON)
                .content("{\"anzeigeName\":\"Gehackt\"}"))
            .andExpect(status().isForbidden());
    }

    /**
     * Unauthentifizierte Anfrage ohne Session wird mit 401 abgewiesen.
     * Stellt sicher dass der Endpunkt ueberhaupt eine Session voraussetzt.
     */
    @Test
    void ohneSessionGibt401() throws Exception {
        UUID beliebigeSpielerID = UUID.randomUUID();

        mockMvc.perform(put("/api/spieler/{id}/profil", beliebigeSpielerID)
                .contentType(APPLICATION_JSON)
                .content("{\"anzeigeName\":\"Angreifer\"}"))
            .andExpect(status().isUnauthorized());
    }

    /**
     * Bestenliste liefert leere Liste wenn noch keine Spiele gespielt wurden.
     * Stellt sicher dass der Endpoint immer eine gueltige Antwort liefert.
     */
    @Test
    void bestenlisteGibtLeereListeWennKeineSpieleVorhanden() throws Exception {
        mockMvc.perform(get("/api/spieler/leaderboard"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.eintraege").isArray());
    }

    /**
     * Spieler darf sein eigenes Konto loeschen (204 No Content).
     * Stellt sicher dass der DSGVO-Art.-17-Loeschpfad erreichbar ist.
     */
    @Test
    void eigeneKontoLoeschenGibt204() throws Exception {
        MvcResult registrierung = registriereSpieler("loeschtestSpieler", "sicheresPasswort123");
        UUID spielerId = extrahiereSpielerId(registrierung);
        MockHttpSession session = (MockHttpSession) registrierung.getRequest().getSession();

        mockMvc.perform(delete("/api/spieler/{id}", spielerId)
                .session(session))
            .andExpect(status().isNoContent());
    }

    /**
     * Spieler darf kein fremdes Konto loeschen (403 Forbidden).
     * Verhindert dass ein authentifizierter Spieler Daten anderer Spieler entfernt.
     */
    @Test
    void fremdesKontoLoeschenGibt403() throws Exception {
        MvcResult spielerA = registriereSpieler("loeschAngreifer", "sicheresPasswort123");
        MvcResult spielerB = registriereSpieler("loeschOpfer", "sicheresPasswort123");

        UUID spielerBId = extrahiereSpielerId(spielerB);
        MockHttpSession sessionA = (MockHttpSession) spielerA.getRequest().getSession();

        mockMvc.perform(delete("/api/spieler/{id}", spielerBId)
                .session(sessionA))
            .andExpect(status().isForbidden());
    }

    /**
     * Unauthentifizierte Konto-Loeschung ohne Session wird mit 401 abgewiesen.
     * Stellt sicher dass der Delete-Endpunkt eine aktive Session voraussetzt.
     */
    @Test
    void kontoLoeschenOhneSessionGibt401() throws Exception {
        mockMvc.perform(delete("/api/spieler/{id}", UUID.randomUUID()))
            .andExpect(status().isUnauthorized());
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
