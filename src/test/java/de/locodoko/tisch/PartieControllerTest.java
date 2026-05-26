package de.locodoko.tisch;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import de.locodoko.karten.Farbe;
import de.locodoko.karten.Karte;
import de.locodoko.karten.Kartenwert;
import de.locodoko.karten.Spieltyp;
import de.locodoko.karten.Hand;
import de.locodoko.partie.Partie;
import de.locodoko.partie.Spiel;
import de.locodoko.partie.Spielphase;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerNameAnfrage;
import de.locodoko.spieler.SpielerRepository;
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

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integrationstests fuer {@link PartieController}.
 *
 * <p>Prueft den vollstaendigen HTTP-Pfad: REST-Request bis Snapshot-Antwort,
 * inklusive Maskierung fremder Handkarten auf Serverseite.</p>
 */
@SpringBootTest
@Transactional
class PartieControllerTest {

    @Autowired
    private WebApplicationContext wac;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TischRepository tischRepository;

    @Autowired
    private SpielerRepository spielerRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    /**
     * Kein Spieler darf via REST die Handkarten eines anderen Spielers einsehen.
     * Serverseitige Maskierung ist die letzte Verteidigungslinie gegen API-Cheating:
     * Selbst wenn ein Spieler direkt den REST-Endpunkt abfragt, darf er keine
     * karteId fremder Handkarten erhalten — nur die Anzahl fuer den Kartenruecken-Faecker.
     */
    @Test
    void maskiertGegnerHandkartenImPartieStandViaREST() throws Exception {
        MockHttpSession adaSession = registriereSpieler("AdaMaskCtrl");
        SpielerEntity ada = spielerRepository.findBySessionId(adaSession.getId()).orElseThrow();
        SpielerEntity bert = spielerRepository.saveAndFlush(SpielerEntity.menschlich("BertMaskCtrl", "session-bert-mask-ctrl"));
        SpielerEntity clara = spielerRepository.saveAndFlush(SpielerEntity.menschlich("ClaraMaskCtrl", "session-clara-mask-ctrl"));
        SpielerEntity dirk = spielerRepository.saveAndFlush(SpielerEntity.menschlich("DirkMaskCtrl", "session-dirk-mask-ctrl"));

        TischEntity tisch = TischEntity.neu("MaskierungsTisch", ada, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(ada);    // → SUED (Index 0 laut standardReihenfolge)
        tisch.fuegeSpielerHinzu(bert);   // → WEST (Index 1)
        tisch.fuegeSpielerHinzu(clara);  // → NORD (Index 2)
        tisch.fuegeSpielerHinzu(dirk);   // → OST  (Index 3)

        Partie partie = Partie.neuePersistenz(8);
        Spiel spiel = Spiel.neuePersistenz(1, SpielerPosition.SUED, Spieltyp.NORMALSPIEL, Spielphase.VORBEHALT_ANSAGE);
        spiel.ersetzeHaende(Map.of(
            SpielerPosition.SUED, new Hand(List.of(
                new Karte(Farbe.KREUZ, Kartenwert.DAME, 1),
                new Karte(Farbe.HERZ, Kartenwert.ZEHN, 1)
            )),
            SpielerPosition.NORD, new Hand(List.of(
                new Karte(Farbe.KARO, Kartenwert.AS, 1),
                new Karte(Farbe.PIK, Kartenwert.KOENIG, 1)
            ))
        ));
        partie.fuegeSpielHinzu(spiel);
        tisch.setzePartie(partie);
        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

        MvcResult ergebnis = mockMvc.perform(
                get("/api/partien/{id}/stand", gespeichert.partie().id()).session(adaSession))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode root = objectMapper.readTree(ergebnis.getResponse().getContentAsString());
        JsonNode spielerArray = root.path("laufendesSpiel").path("spieler");

        JsonNode sued = spielerArray.get(0);
        assertEquals("SUED", sued.get("position").asText());
        assertFalse(sued.get("sichtbareHandkarten").isNull(),
            "Eigene Handkarten (SUED) muessen im Snapshot sichtbar sein");
        assertEquals(2, sued.get("sichtbareHandkarten").size(),
            "Ada hat genau 2 Karten auf der Hand");
        assertEquals("KREUZ-DAME-1", sued.get("sichtbareHandkarten").get(0).get("id").asText(),
            "karteId der eigenen Karte muss korrekt geliefert werden");

        JsonNode nord = spielerArray.get(2);
        assertEquals("NORD", nord.get("position").asText());
        assertTrue(nord.get("sichtbareHandkarten").isNull(),
            "Gegner-Handkarten (NORD) duerfen via REST keine karteId preisgeben — nur Anzahl");
        assertEquals(2, nord.get("verbleibendeKarten").asInt(),
            "Kartenanzahl des Gegners muss trotz Maskierung korrekt geliefert werden");
    }

    private MockHttpSession registriereSpieler(String name) throws Exception {
        MvcResult ergebnis = mockMvc.perform(post("/api/spieler/session")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SpielerNameAnfrage(name))))
            .andExpect(status().isCreated())
            .andReturn();
        return (MockHttpSession) ergebnis.getRequest().getSession(false);
    }
}
