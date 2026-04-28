package de.locodoko.tisch;

import tools.jackson.databind.ObjectMapper;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.partie.Partie;
import de.locodoko.partie.Spiel;
import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerRepository;
import de.locodoko.tisch.TischEntity;
import de.locodoko.tisch.TischRepository;
import de.locodoko.tisch.TischStatus;
import de.locodoko.tisch.TischkonfigurationEmbeddable;

import de.locodoko.spieler.SpielerNameAnfrage;
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
@Transactional
class TischControllerTest {

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
        gestarteterTisch.setzePartie(Partie.neuePersistenz(24));
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
                .content(objectMapper.writeValueAsString(new TischErstellenAnfrage("Abendtisch", null, null))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Abendtisch"))
            .andExpect(jsonPath("$.einladungsCode").isNotEmpty())
            .andExpect(jsonPath("$.status").value(TischStatus.WARTEND.name()))
            .andExpect(jsonPath("$.spieler.length()").value(1))
            .andExpect(jsonPath("$.konfiguration.anzahlSpiele").value(24))
            .andExpect(jsonPath("$.konfiguration.tischhintergrund").value(Tischhintergrund.OVAL_2.name()))
            .andReturn();

        TischAntwort antwort = objectMapper.readValue(ergebnis.getResponse().getContentAsByteArray(), TischAntwort.class);
        TischEntity gespeichert = tischRepository.findById(TischId.von(antwort.id())).orElseThrow();
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

        TischEntity geladen = tischRepository.findById(TischId.von(tischId)).orElseThrow();
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

        TischEntity geladen = tischRepository.findById(TischId.von(tischId)).orElseThrow();
        assertEquals(TischStatus.IM_SPIEL, geladen.status(),
            "Der Tischstatus muss nach dem Start umspringen, damit Lobby und Spielansicht denselben Startzustand sehen.");
        assertEquals(4, geladen.spieler().size(),
            "Freie Sitze muessen beim Start automatisch mit KI gefuellt werden, damit der Einzelspielermodus sofort spielbar ist.");
        assertTrue(geladen.spieler().stream().anyMatch(SpielerEntity::istKi),
            "Mindestens ein KI-Spieler muss erzeugt werden, wenn weniger als vier Menschen am Tisch sitzen.");
        assertNotNull(geladen.partie());
        assertEquals(24, geladen.partie().anzahlSpieleAusDb());
        assertEquals(1, geladen.partie().spiele().size(),
            "Beim Start muss bereits ein echtes erstes Spiel angelegt werden, damit die Tischansicht sofort Handkarten und Phase aus einem stabilen Snapshot lesen kann.");
        Spiel erstesSpiel = geladen.partie().spiele().getFirst();
        assertEquals(4, erstesSpiel.haendeAlsJson().size(),
            "Das erste Spiel muss alle vier Haende enthalten, weil die spielbare Tischansicht ohne nachgelagerten Platzhalter direkt mit echten Karten startet.");
        assertEquals(10, erstesSpiel.haendeAlsJson().getFirst().karten().size(),
            "Jeder Spieler braucht direkt nach dem Start eine vollstaendige Hand, damit Vorbehalt-Phase und Kartendarstellung denselben serverseitigen Wahrheitsstand sehen.");
    }

    @Test
    void gibtKonfigurationZurueckUndAktualisiertSieVorSpielbeginn() throws Exception {
        MockHttpSession adaSession = registriereSpieler("Ada");
        UUID tischId = erstelleTisch(adaSession, "Konfigurationstisch");

        mockMvc.perform(get("/api/tische/{id}/konfiguration", tischId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ohneNeunen").value(true))
            .andExpect(jsonPath("$.anzahlSpiele").value(24))
            .andExpect(jsonPath("$.tischhintergrund").value(Tischhintergrund.OVAL_2.name()));

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
            7,
            false,
            false,
            false,
            false,
            false,
            KiSchwierigkeit.STANDARD
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
            7,
            false,
            false,
            false,
            false,
            false,
            KiSchwierigkeit.STANDARD
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
        // Wichtig: Seit der Session-Validierung braucht GET /api/partien/{id}/stand eine gueltige
        // Session, damit sensible Spielstandsdaten (Handkarten, Ansagen) nicht anonym abrufbar sind.
        MockHttpSession adaSession = registriereSpieler("AdaStand");
        SpielerEntity ada = spielerRepository.findBySessionId(adaSession.getId()).orElseThrow();

        TischEntity tisch = TischEntity.neu("Standtisch", ada, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(ada);
        Partie partie = Partie.neuePersistenz(16);
        partie.setzeGesamtpunktestand(SpielerPosition.SUED, 4);
        partie.setzeGesamtpunktestand(SpielerPosition.WEST, -2);
        partie.setzeGesamtpunktestand(SpielerPosition.NORD, -1);
        partie.setzeGesamtpunktestand(SpielerPosition.OST, -1);
        tisch.setzePartie(partie);
        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

        mockMvc.perform(get("/api/partien/{id}/stand", gespeichert.partie().id()).session(adaSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.anzahlSpiele").value(16))
            .andExpect(jsonPath("$.gespielteSpiele").value(0))
            .andExpect(jsonPath("$.gesamtpunktestand.SUED").value(4))
            .andExpect(jsonPath("$.gesamtpunktestand.WEST").value(-2));
    }

    @Test
    void lehntPartieStandOhneSessionMit401Ab() throws Exception {
        // Wichtig: Ohne Session-Validierung koennte jeder fremde Partie-Stand abrufen —
        // das verletzt die Informationstrennung zwischen Spielern (verdeckte Haende, Ansagen).
        SpielerEntity ada = spielerRepository.saveAndFlush(SpielerEntity.menschlich("Ada401", "session-401-ada"));
        TischEntity tisch = TischEntity.neu("Tisch401", ada, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(ada);
        tisch.setzePartie(Partie.neuePersistenz(8));
        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

        mockMvc.perform(get("/api/partien/{id}/stand", gespeichert.partie().id()))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.fehlerCode").value("SPIELER_SESSION_UNGUELTIG"));
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
    void erlaubtVerlassenEinesAktivenTischesUndBrichtPartieAb() throws Exception {
        // Wichtig: Bisher war verlasseTisch() auf wartende Tische beschraenkt.
        // Jetzt muss ein Spieler auch einen laufenden Tisch verlassen koennen —
        // das loest ein PARTIE_ABGEBROCHEN-Event aus, statt einen 409-Fehler.
        // Das ist die Grundlage fuer den "Tisch verlassen"-Button in der Tischansicht.
        MockHttpSession adaSession = registriereSpieler("AdaAbbruch");
        SpielerEntity ada = spielerRepository.findBySessionId(adaSession.getId()).orElseThrow();

        TischEntity tisch = TischEntity.neu("AbbruchTisch", ada, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(ada);
        Partie partie = Partie.neuePersistenz(8);
        tisch.setzePartie(partie);
        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);
        UUID tischId = gespeichert.id();

        assertEquals(TischStatus.IM_SPIEL, gespeichert.status(),
            "Nach setzePartie() muss der Tisch den Status IM_SPIEL haben, damit die neue Logik greift.");

        mockMvc.perform(post("/api/tische/{id}/verlassen", tischId).session(adaSession))
            .andExpect(status().isOk());

        assertTrue(tischRepository.findById(TischId.von(tischId)).isEmpty(),
            "Nach Abbruch einer laufenden Partie wird der Tisch geloescht, damit kein verwaister Tischzustand entsteht.");
    }

    @Test
    void liefertNichtGefundenFuerUnbekanntenTisch() throws Exception {
        mockMvc.perform(get("/api/tische/{id}/konfiguration", UUID.randomUUID()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.fehlerCode").value("TISCH_NICHT_GEFUNDEN"));
    }

    @Test
    void startetNeuePartieNachBeendetterPartie() throws Exception {
        // WARUM: Wenn alle Spiele einer Partie abgeschlossen sind, muss POST /neue-partie
        // eine frische Partie anlegen und alle Clients per Event benachrichtigen.
        // Ohne diesen Endpunkt koennen Spieler nach Partie-Ende nicht weiterspielen.
        MockHttpSession adaSession = registriereSpieler("AdaNeuePartie");
        SpielerEntity ada = spielerRepository.findBySessionId(adaSession.getId()).orElseThrow();

        TischEntity tisch = TischEntity.neu("NeuePartieTisch", ada, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(ada);
        Partie beendetePartie = Partie.neuePersistenz(8);
        beendetePartie.markiereAlsBeendet();
        tisch.setzePartie(beendetePartie);
        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);
        UUID tischId = gespeichert.id();
        UUID altePartieId = gespeichert.partie().id();

        mockMvc.perform(post("/api/tische/{id}/neue-partie", tischId).session(adaSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.nachricht").value("Neue Partie gestartet."));

        TischEntity geladen = tischRepository.findById(TischId.von(tischId)).orElseThrow();
        assertNotNull(geladen.partie(),
            "Nach neue-partie muss eine Partie vorhanden sein, damit der PartieStand abrufbar ist.");
        assertTrue(!geladen.partie().id().equals(altePartieId),
            "Die neue Partie muss eine andere UUID haben als die abgeschlossene Partie.");
        assertEquals("LAUFEND", geladen.partie().status().name(),
            "Die neue Partie muss sofort in den Status LAUFEND wechseln, damit das Spiel direkt beginnt.");
        assertEquals(TischStatus.IM_SPIEL, geladen.status(),
            "Der Tischstatus muss IM_SPIEL bleiben, damit die Tischansicht keine Szene wechselt.");
    }

    @Test
    void lehntNeuePartieAbWennPartieLaeuft() throws Exception {
        // WARUM: Wenn die Partie noch laeuft (nicht BEENDET), soll neue-partie idempotent
        // "Partie laeuft bereits" zurueckgeben statt einen Fehler zu werfen.
        // Das schuetzt vor Doppelstarts bei gleichzeitigen Anfragen mehrerer Clients.
        MockHttpSession adaSession = registriereSpieler("AdaLaufend");
        SpielerEntity ada = spielerRepository.findBySessionId(adaSession.getId()).orElseThrow();

        TischEntity tisch = TischEntity.neu("LaufendTisch", ada, TischkonfigurationEmbeddable.standard());
        tisch.fuegeSpielerHinzu(ada);
        Partie laufendePartie = Partie.neuePersistenz(8);
        tisch.setzePartie(laufendePartie);
        TischEntity gespeichert = tischRepository.saveAndFlush(tisch);

        mockMvc.perform(post("/api/tische/{id}/neue-partie", gespeichert.id()).session(adaSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.nachricht").value("Partie laeuft bereits."));
    }

    @Test
    void schnellstartErstelltNeuenTischWennKeinOffenerVorhanden() throws Exception {
        // WARUM: Wenn kein offener Tisch existiert, muss Schnellstart automatisch einen neuen
        // Tisch erstellen, mit KI auffuellen und die Partie sofort starten — alles in einem Request.
        MockHttpSession adaSession = registriereSpieler("AdaSchnell");

        MvcResult ergebnis = mockMvc.perform(post("/api/tische/schnellstart").session(adaSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(TischStatus.IM_SPIEL.name()))
            .andExpect(jsonPath("$.spieler.length()").value(4))
            .andExpect(jsonPath("$.name").value("Schnellstart von AdaSchnell"))
            .andReturn();

        TischAntwort antwort = objectMapper.readValue(ergebnis.getResponse().getContentAsByteArray(), TischAntwort.class);
        TischEntity geladen = tischRepository.findById(TischId.von(antwort.id())).orElseThrow();
        assertEquals(4, geladen.spieler().size(),
            "Schnellstart muss den Tisch mit KI-Spielern auffuellen, damit die Partie sofort spielbar ist.");
        assertNotNull(geladen.partie(),
            "Schnellstart muss automatisch eine Partie anlegen.");
        assertTrue(geladen.spieler().stream().filter(SpielerEntity::istKi).count() >= 3,
            "Beim Solo-Schnellstart muessen mindestens 3 KI-Spieler erzeugt werden.");
    }

    @Test
    void schnellstartTrittBestehendemOffenenTischBei() throws Exception {
        // WARUM: Wenn bereits ein offener Tisch mit freiem Platz existiert, soll Schnellstart
        // den Spieler dort einsetzen statt einen neuen Tisch zu erstellen.
        MockHttpSession adaSession = registriereSpieler("AdaOffen");
        erstelleTisch(adaSession, "Offener Tisch");

        MockHttpSession bertSession = registriereSpieler("BertSchnell");
        MvcResult ergebnis = mockMvc.perform(post("/api/tische/schnellstart").session(bertSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(TischStatus.IM_SPIEL.name()))
            .andExpect(jsonPath("$.name").value("Offener Tisch"))
            .andExpect(jsonPath("$.spieler.length()").value(4))
            .andReturn();

        TischAntwort antwort = objectMapper.readValue(ergebnis.getResponse().getContentAsByteArray(), TischAntwort.class);
        TischEntity geladen = tischRepository.findById(TischId.von(antwort.id())).orElseThrow();
        long menschlicheSpieler = geladen.spieler().stream().filter(s -> !s.istKi()).count();
        assertEquals(2, menschlicheSpieler,
            "Schnellstart muss den zweiten Spieler zum bestehenden Tisch hinzufuegen, bevor KI aufgefuellt wird.");
    }

    @Test
    void schnellstartLehntAbWennSpielerBereitsAnTischSitzt() throws Exception {
        // WARUM: Ein Spieler darf nur an einem Tisch gleichzeitig sitzen.
        // Schnellstart muss denselben Schutz bieten wie manuelles Beitreten.
        MockHttpSession adaSession = registriereSpieler("AdaDoppelt");
        erstelleTisch(adaSession, "Besetzter Tisch");

        mockMvc.perform(post("/api/tische/schnellstart").session(adaSession))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.fehlerCode").value("SPIELER_BEREITS_AN_TISCH"));
    }

    // ── Einladungslink-Tests ────────────────────────────────────────────────────

    @Test
    void einladungsCodeWird8StelligAlphanumerischGeneriert() throws Exception {
        // WARUM: Der Einladungscode dient als kurzer, teilbarer Link-Identifier. Er muss
        // exakt 8 Zeichen lang sein und nur verwechslungssichere Zeichen enthalten.
        MockHttpSession adaSession = registriereSpieler("AdaCode");
        UUID tischId = erstelleTisch(adaSession, "Code-Tisch");

        TischEntity tisch = tischRepository.findById(TischId.von(tischId)).orElseThrow();
        assertNotNull(tisch.einladungsCode(), "Einladungscode muss auto-generiert werden");
        assertEquals(8, tisch.einladungsCode().length(),
            "Einladungscode muss exakt 8 Zeichen lang sein");
        assertTrue(tisch.einladungsCode().matches("[A-Z0-9]{8}"),
            "Einladungscode darf nur Grossbuchstaben und Ziffern enthalten");
    }

    @Test
    void einladungsCodeWirdInRestAntwortMitgeliefert() throws Exception {
        // WARUM: Das Frontend braucht den Code um den „Link teilen"-Button zu befuellen.
        MockHttpSession adaSession = registriereSpieler("AdaAntwort");

        mockMvc.perform(post("/api/tische")
                .session(adaSession)
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new TischErstellenAnfrage("Antwort-Tisch", null, null))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.einladungsCode").isNotEmpty())
            .andExpect(jsonPath("$.einladungsCode").isString());
    }

    @Test
    void laesstSpielerPerEinladungscodeBeitreten() throws Exception {
        // WARUM: Kernfunktion des Einladungslinks — Code-basierter Beitritt statt UUID.
        MockHttpSession adaSession = registriereSpieler("AdaEinladung");
        MockHttpSession bertSession = registriereSpieler("BertEinladung");

        UUID tischId = erstelleTisch(adaSession, "Einladungstisch");
        TischEntity tisch = tischRepository.findById(TischId.von(tischId)).orElseThrow();
        String code = tisch.einladungsCode();

        mockMvc.perform(post("/api/tische/beitreten/{code}", code).session(bertSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.spieler.length()").value(2))
            .andExpect(jsonPath("$.spieler[1].name").value("BertEinladung"));
    }

    @Test
    void einladungscodeIstCaseInsensitive() throws Exception {
        // WARUM: Benutzer koennten den Code klein eintippen — Gross/Klein soll egal sein.
        MockHttpSession adaSession = registriereSpieler("AdaCase");
        MockHttpSession bertSession = registriereSpieler("BertCase");

        UUID tischId = erstelleTisch(adaSession, "CaseTisch");
        TischEntity tisch = tischRepository.findById(TischId.von(tischId)).orElseThrow();
        String kleingeschrieben = tisch.einladungsCode().toLowerCase();

        mockMvc.perform(post("/api/tische/beitreten/{code}", kleingeschrieben).session(bertSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.spieler.length()").value(2));
    }

    @Test
    void gibtFehlerBeiUngueltigemEinladungscode() throws Exception {
        // WARUM: Ungueltige Codes muessen sauber abgewiesen werden (404, nicht 500).
        MockHttpSession bertSession = registriereSpieler("BertUngueltig");

        mockMvc.perform(post("/api/tische/beitreten/{code}", "XXXXXXXX").session(bertSession))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.fehlerCode").value("EINLADUNGSCODE_UNGUELTIG"));
    }

    @Test
    void einladungscodesVerschiedenerTischeSindUnterschiedlich() throws Exception {
        // WARUM: UNIQUE-Constraint in DB — jeder Tisch braucht einen eigenen Code.
        MockHttpSession adaSession = registriereSpieler("AdaUnique1");
        MockHttpSession bertSession = registriereSpieler("BertUnique2");

        UUID tischId1 = erstelleTisch(adaSession, "Tisch A");
        TischEntity tisch1 = tischRepository.findById(TischId.von(tischId1)).orElseThrow();

        UUID tischId2 = erstelleTisch(bertSession, "Tisch B");
        TischEntity tisch2 = tischRepository.findById(TischId.von(tischId2)).orElseThrow();

        assertTrue(!tisch1.einladungsCode().equals(tisch2.einladungsCode()),
            "Verschiedene Tische muessen unterschiedliche Einladungscodes haben");
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
                .content(objectMapper.writeValueAsString(new TischErstellenAnfrage(name, null, null))))
            .andExpect(status().isCreated())
            .andReturn();
        TischAntwort antwort = objectMapper.readValue(ergebnis.getResponse().getContentAsByteArray(), TischAntwort.class);
        return antwort.id();
    }
}
