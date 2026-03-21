package de.locodoko.spielverwaltung.tisch;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.locodoko.spiel.karten.SpielerPosition;
import de.locodoko.spielverwaltung.persistenz.PartieEntity;
import de.locodoko.spielverwaltung.persistenz.SpielEntity;
import de.locodoko.spielverwaltung.persistenz.SpielerEntity;
import de.locodoko.spielverwaltung.persistenz.SpielerRepository;
import de.locodoko.spielverwaltung.persistenz.TischEntity;
import de.locodoko.spielverwaltung.persistenz.TischRepository;
import de.locodoko.spielverwaltung.persistenz.TischStatus;
import de.locodoko.spielverwaltung.persistenz.TischkonfigurationEmbeddable;
import de.locodoko.spielverwaltung.session.SpielerNameAnfrage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

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
@Transactional
class TischControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TischRepository tischRepository;

    @Autowired
    private SpielerRepository spielerRepository;

    @Test
    void listetNurOffeneTischeMitKurzerKonfiguration() throws Exception {
        SpielerEntity ada = spielerRepository.saveAndFlush(SpielerEntity.menschlich("Ada", "session-liste-ada"));
        SpielerEntity bert = spielerRepository.saveAndFlush(SpielerEntity.menschlich("Bert", "session-liste-bert"));

        TischEntity offenerTisch = TischEntity.neu("Offen", ada, TischkonfigurationEmbeddable.standard());
        offenerTisch.fuegeSpielerHinzu(ada);
        tischRepository.saveAndFlush(offenerTisch);

        TischEntity gestarteterTisch = TischEntity.neu("Gestartet", bert, TischkonfigurationEmbeddable.standard());
        gestarteterTisch.fuegeSpielerHinzu(bert);
        gestarteterTisch.setzePartie(PartieEntity.neu(24));
        tischRepository.saveAndFlush(gestarteterTisch);

        mockMvc.perform(get("/api/tische"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].name").value("Offen"))
            .andExpect(jsonPath("$[0].spielerAnzahl").value(1))
            .andExpect(jsonPath("$[0].kurzKonfiguration.anzahlSpiele").value(24));
    }

    @Test
    void erstelltTischMitStandardkonfigurationUndFuegtErstellerHinzu() throws Exception {
        MockHttpSession session = registriereSpieler("Ada");

        MvcResult ergebnis = mockMvc.perform(post("/api/tische")
                .session(session)
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new TischErstellenAnfrage("Abendtisch", null))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Abendtisch"))
            .andExpect(jsonPath("$.status").value(TischStatus.WARTEND.name()))
            .andExpect(jsonPath("$.spieler.length()").value(1))
            .andExpect(jsonPath("$.konfiguration.anzahlSpiele").value(24))
            .andExpect(jsonPath("$.konfiguration.tischhintergrund").value(Tischhintergrund.FILZ_GRUEN.name()))
            .andReturn();

        TischAntwort antwort = objectMapper.readValue(ergebnis.getResponse().getContentAsByteArray(), TischAntwort.class);
        TischEntity gespeichert = tischRepository.findById(antwort.id()).orElseThrow();
        assertEquals(1, gespeichert.spieler().size(),
            "Der Ersteller muss sofort am Tisch sitzen, damit die Lobby ohne weiteren Join-Schritt konsistent bleibt.");
    }

    @Test
    void laesstSpielerOffenemTischBeitreten() throws Exception {
        MockHttpSession adaSession = registriereSpieler("Ada");
        MockHttpSession bertSession = registriereSpieler("Bert");

        UUID tischId = erstelleTisch(adaSession, "Beitrittstisch");

        mockMvc.perform(post("/api/tische/{id}/beitreten", tischId).session(bertSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.spieler.length()").value(2))
            .andExpect(jsonPath("$.spieler[1].name").value("Bert"));
    }

    @Test
    void verhindertBeitrittWennSpielerBereitsAnAnderemTischSitzt() throws Exception {
        MockHttpSession adaSession = registriereSpieler("Ada");
        MockHttpSession bertSession = registriereSpieler("Bert");

        erstelleTisch(bertSession, "Erster Tisch");
        UUID zweiterTisch = erstelleTisch(adaSession, "Zweiter Tisch");

        mockMvc.perform(post("/api/tische/{id}/beitreten", zweiterTisch).session(bertSession))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.fehlerCode").value("SPIELER_BEREITS_AN_TISCH"));
    }

    @Test
    void verlaesstTischVorSpielbeginnUndSetztBeiBedarfNeuenErsteller() throws Exception {
        MockHttpSession adaSession = registriereSpieler("Ada");
        MockHttpSession bertSession = registriereSpieler("Bert");
        UUID tischId = erstelleTisch(adaSession, "Wechseltisch");
        mockMvc.perform(post("/api/tische/{id}/beitreten", tischId).session(bertSession))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/tische/{id}/verlassen", tischId).session(adaSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.nachricht").value("Tisch erfolgreich verlassen."));

        TischEntity geladen = tischRepository.findById(tischId).orElseThrow();
        assertEquals(1, geladen.spieler().size(),
            "Nach dem Verlassen muss die Sitzbelegung reduziert sein, damit freie Plaetze spaeter korrekt mit KI aufgefuellt werden.");
        assertEquals("Bert", geladen.erstelltVon().name(),
            "Wenn der Ersteller vor dem Start geht, braucht der Tisch einen neuen Besitzer, damit die Startberechtigung erhalten bleibt.");
    }

    @Test
    void startetTischFuelltMitKiAufUndLegtPartieAn() throws Exception {
        MockHttpSession adaSession = registriereSpieler("Ada");
        UUID tischId = erstelleTisch(adaSession, "Starttisch");

        mockMvc.perform(post("/api/tische/{id}/starten", tischId).session(adaSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.nachricht").value("Tisch " + tischId + " wurde gestartet."));

        TischEntity geladen = tischRepository.findById(tischId).orElseThrow();
        assertEquals(TischStatus.IM_SPIEL, geladen.status(),
            "Der Tischstatus muss nach dem Start umspringen, damit Lobby und Spielansicht denselben Startzustand sehen.");
        assertEquals(4, geladen.spieler().size(),
            "Freie Sitze muessen beim Start automatisch mit KI gefuellt werden, damit der Einzelspielermodus sofort spielbar ist.");
        assertTrue(geladen.spieler().stream().anyMatch(SpielerEntity::istKi),
            "Mindestens ein KI-Spieler muss erzeugt werden, wenn weniger als vier Menschen am Tisch sitzen.");
        assertNotNull(geladen.partie());
        assertEquals(24, geladen.partie().anzahlSpiele());
        assertEquals(1, geladen.partie().spiele().size(),
            "Beim Start muss bereits ein echtes erstes Spiel angelegt werden, damit die Tischansicht sofort Handkarten und Phase aus einem stabilen Snapshot lesen kann.");
        SpielEntity erstesSpiel = geladen.partie().spiele().getFirst();
        assertEquals(4, erstesSpiel.haende().size(),
            "Das erste Spiel muss alle vier Haende enthalten, weil die spielbare Tischansicht ohne nachgelagerten Platzhalter direkt mit echten Karten startet.");
        assertEquals(12, erstesSpiel.haende().getFirst().karten().size(),
            "Jeder Spieler braucht direkt nach dem Start eine vollstaendige Hand, damit Vorbehalt-Phase und Kartendarstellung denselben serverseitigen Wahrheitsstand sehen.");
    }

    @Test
    void gibtKonfigurationZurueckUndAktualisiertSieVorSpielbeginn() throws Exception {
        MockHttpSession adaSession = registriereSpieler("Ada");
        UUID tischId = erstelleTisch(adaSession, "Konfigurationstisch");

        mockMvc.perform(get("/api/tische/{id}/konfiguration", tischId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ohneNeunen").value(false))
            .andExpect(jsonPath("$.anzahlSpiele").value(24))
            .andExpect(jsonPath("$.tischhintergrund").value(Tischhintergrund.FILZ_GRUEN.name()));

        TischKonfigurationDto neueKonfiguration = new TischKonfigurationDto(
            true,
            12,
            Tischhintergrund.HOLZ_DUNKEL,
            true,
            false,
            true,
            true,
            true,
            true,
            true,
            true,
            false,
            true,
            11,
            10,
            9,
            8,
            7
        );

        mockMvc.perform(put("/api/tische/{id}/konfiguration", tischId)
                .session(adaSession)
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(neueKonfiguration)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ohneNeunen").value(true))
            .andExpect(jsonPath("$.anzahlSpiele").value(12))
            .andExpect(jsonPath("$.tischhintergrund").value(Tischhintergrund.HOLZ_DUNKEL.name()))
            .andExpect(jsonPath("$.armutErlaubt").value(false))
            .andExpect(jsonPath("$.karlchenAktiv").value(false));
    }

    @Test
    void lehntUngueltigeKonfigurationMitStrukturiertemFehlerAb() throws Exception {
        MockHttpSession adaSession = registriereSpieler("Ada");
        UUID tischId = erstelleTisch(adaSession, "Ungueltige Konfiguration");

        TischKonfigurationDto ungueltig = new TischKonfigurationDto(
            false,
            0,
            Tischhintergrund.FILZ_GRUEN,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            11,
            10,
            9,
            8,
            7
        );

        mockMvc.perform(put("/api/tische/{id}/konfiguration", tischId)
                .session(adaSession)
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ungueltig)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fehlerCode").value("ANFRAGE_UNGUELTIG"));
    }

    @Test
    void liefertPartieStandMitGesamtpunktestandUndSpielanzahl() throws Exception {
        SpielerEntity ada = spielerRepository.saveAndFlush(SpielerEntity.menschlich("Ada", "session-stand-ada"));
        TischEntity tisch = TischEntity.neu("Standtisch", ada, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(ada);
        PartieEntity partie = PartieEntity.neu(16);
        partie.setzeGesamtpunktestand(SpielerPosition.SUED, 4);
        partie.setzeGesamtpunktestand(SpielerPosition.WEST, -2);
        partie.setzeGesamtpunktestand(SpielerPosition.NORD, -1);
        partie.setzeGesamtpunktestand(SpielerPosition.OST, -1);
        tisch.setzePartie(partie);
        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

        mockMvc.perform(get("/api/partien/{id}/stand", gespeichert.partie().id()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.anzahlSpiele").value(16))
            .andExpect(jsonPath("$.gespielteSpiele").value(0))
            .andExpect(jsonPath("$.gesamtpunktestand.SUED").value(4))
            .andExpect(jsonPath("$.gesamtpunktestand.WEST").value(-2));
    }

    @Test
    void verhindertBeitrittWennTischVollIst() throws Exception {
        // Wichtig: Die TISCH_VOLL-Pruefung muss nach dem pessimistischen Lock erfolgen,
        // damit zwei gleichzeitige Beitrittsanfragen nicht beide die Pruefung passieren
        // und den Tisch auf 5 Spieler aufblasen koennen. Dieser Test sichert den
        // 409-Fehlerfall als Vertragsbasis fuer den Concurrency-Schutz ab.
        MockHttpSession adaSession = registriereSpieler("Ada");
        MockHttpSession bertSession = registriereSpieler("Bert");
        MockHttpSession claraSession = registriereSpieler("Clara");
        MockHttpSession davidSession = registriereSpieler("David");
        MockHttpSession evaSession = registriereSpieler("Eva");

        UUID tischId = erstelleTisch(adaSession, "Voller Tisch");
        mockMvc.perform(post("/api/tische/{id}/beitreten", tischId).session(bertSession))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/tische/{id}/beitreten", tischId).session(claraSession))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/tische/{id}/beitreten", tischId).session(davidSession))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/tische/{id}/beitreten", tischId).session(evaSession))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.fehlerCode").value("TISCH_VOLL"));
    }

    @Test
    void verhindertZweitenStartDesselbenTisches() throws Exception {
        // Wichtig: Die TISCH_BEREITS_GESTARTET-Pruefung muss nach dem pessimistischen
        // Lock erfolgen, damit zwei gleichzeitige Startanfragen nicht beide den Status
        // WARTEND sehen und doppelte Partien anlegen. Dieser Test sichert den
        // 409-Fehlerfall fuer einen bereits gestarteten Tisch ab.
        MockHttpSession adaSession = registriereSpieler("AdaStart");
        UUID tischId = erstelleTisch(adaSession, "Einmal-Start-Tisch");

        mockMvc.perform(post("/api/tische/{id}/starten", tischId).session(adaSession))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/tische/{id}/starten", tischId).session(adaSession))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.fehlerCode").value("TISCH_BEREITS_GESTARTET"));
    }

    @Test
    void liefertNichtGefundenFuerUnbekanntenTisch() throws Exception {
        mockMvc.perform(get("/api/tische/{id}/konfiguration", UUID.randomUUID()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.fehlerCode").value("TISCH_NICHT_GEFUNDEN"));
    }

    private MockHttpSession registriereSpieler(String name) throws Exception {
        MvcResult ergebnis = mockMvc.perform(post("/api/spieler/session")
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SpielerNameAnfrage(name))))
            .andExpect(status().isCreated())
            .andReturn();
        return (MockHttpSession) ergebnis.getRequest().getSession(false);
    }

    private UUID erstelleTisch(MockHttpSession session, String name) throws Exception {
        MvcResult ergebnis = mockMvc.perform(post("/api/tische")
                .session(session)
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new TischErstellenAnfrage(name, null))))
            .andExpect(status().isCreated())
            .andReturn();
        TischAntwort antwort = objectMapper.readValue(ergebnis.getResponse().getContentAsByteArray(), TischAntwort.class);
        return antwort.id();
    }
}
