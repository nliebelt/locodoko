package de.locodoko.spieler;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class AuthentifizierungsControllerTest {

    @Autowired
    private WebApplicationContext wac;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SpielerRepository spielerRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    // --- Registrierung ---

    @Test
    @Transactional
    void registriertNeuenSpielerErfolgreich() throws Exception {
        RegistrierungsAnfrage anfrage = new RegistrierungsAnfrage("testuser", "sicheresPasswort123", "test@example.com");

        mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(anfrage)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("testuser"))
            .andExpect(jsonPath("$.authentifizierungsMethode").value("PASSWORT"))
            .andExpect(jsonPath("$.spielerId").isNotEmpty());

        assertTrue(spielerRepository.findByBenutzername("testuser").isPresent());
    }

    @Test
    @Transactional
    void datenbankVerhindertDoppeltenBenutzernamen() {
        // Testet den DB-Level-UNIQUE-Constraint direkt (umgeht den Anwendungs-Pre-Check).
        // Stellt sicher, dass Race Conditions bei paralleler Registrierung auf DB-Ebene abgefangen werden.
        SpielerEntity erster = SpielerEntity.mitPasswort("race_constraint_test", "hash1", null);
        spielerRepository.save(erster);

        SpielerEntity zweiter = SpielerEntity.mitPasswort("race_constraint_test", "hash2", null);
        assertThrows(DataIntegrityViolationException.class,
            () -> spielerRepository.save(zweiter));
    }

    @Test
    @Transactional
    void registrierungMitDoppeltemBenutzernamenGibt409() throws Exception {
        RegistrierungsAnfrage anfrage = new RegistrierungsAnfrage("doppelt", "sicheresPasswort123", null);

        mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(anfrage)))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(anfrage)))
            .andExpect(status().isConflict());
    }

    @Test
    void registrierungMitZuKurzemBenutzernamenGibt400() throws Exception {
        RegistrierungsAnfrage anfrage = new RegistrierungsAnfrage("ab", "sicheresPasswort123", null);

        mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(anfrage)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void registrierungMitZuKurzemPasswortGibt400() throws Exception {
        RegistrierungsAnfrage anfrage = new RegistrierungsAnfrage("testuser2", "kurz", null);

        mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(anfrage)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void registrierungOhneBenutzernameGibt400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content("{\"benutzername\":\"\",\"passwort\":\"sicheresPasswort123\"}"))
            .andExpect(status().isBadRequest());
    }

    // --- Login ---

    @Test
    @Transactional
    void loginMitKorrektemPasswortErfolgreich() throws Exception {
        RegistrierungsAnfrage reg = new RegistrierungsAnfrage("loginuser", "sicheresPasswort123", null);
        mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reg)))
            .andExpect(status().isCreated());

        LoginAnfrage login = new LoginAnfrage("loginuser", "sicheresPasswort123");
        mockMvc.perform(post("/api/auth/login")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(login)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("loginuser"))
            .andExpect(jsonPath("$.authentifizierungsMethode").value("PASSWORT"));
    }

    @Test
    @Transactional
    void loginMitFalschemPasswortGibt401() throws Exception {
        RegistrierungsAnfrage reg = new RegistrierungsAnfrage("logintest", "sicheresPasswort123", null);
        mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reg)))
            .andExpect(status().isCreated());

        LoginAnfrage login = new LoginAnfrage("logintest", "falschesPasswort");
        mockMvc.perform(post("/api/auth/login")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(login)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void loginMitUnbekanntemBenutzerGibt401() throws Exception {
        LoginAnfrage login = new LoginAnfrage("gibtesnicht", "egalWas123");
        mockMvc.perform(post("/api/auth/login")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(login)))
            .andExpect(status().isUnauthorized());
    }

    // --- Logout ---

    @Test
    void logoutGibt200() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
            .andExpect(status().isOk());
    }

    // --- Session-Verknuepfung ---

    @Test
    @Transactional
    void registrierungSetztSessionId() throws Exception {
        RegistrierungsAnfrage anfrage = new RegistrierungsAnfrage("sessionuser", "sicheresPasswort123", null);

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(anfrage)))
            .andExpect(status().isCreated())
            .andReturn();

        SpielerEntity spieler = spielerRepository.findByBenutzername("sessionuser").orElseThrow();
        assertNotNull(spieler.sessionId(), "SessionId muss nach Registrierung gesetzt sein");
    }

    @Test
    @Transactional
    void loginSetztSessionId() throws Exception {
        RegistrierungsAnfrage reg = new RegistrierungsAnfrage("sessionlogin", "sicheresPasswort123", null);
        mockMvc.perform(post("/api/auth/register")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reg)))
            .andExpect(status().isCreated());

        LoginAnfrage login = new LoginAnfrage("sessionlogin", "sicheresPasswort123");
        mockMvc.perform(post("/api/auth/login")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(login)))
            .andExpect(status().isOk());

        SpielerEntity spieler = spielerRepository.findByBenutzername("sessionlogin").orElseThrow();
        assertNotNull(spieler.sessionId(), "SessionId muss nach Login gesetzt sein");
    }
}
