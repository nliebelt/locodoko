package de.locodoko.system;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exportiert die OpenAPI-Spezifikation als JSON-Datei nach {@code target/openapi.json}.
 *
 * <p>Wird im Build genutzt, um daraus per {@code openapi-typescript} die
 * TypeScript-Typen in {@code frontend/src/generated/api-types.ts} zu generieren.</p>
 */
@SpringBootTest
class OpenApiExportTest {

    @Autowired
    private WebApplicationContext wac;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    @Test
    void exportiertOpenApiSpezifikation() throws Exception {
        MvcResult ergebnis = mockMvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andReturn();

        String json = ergebnis.getResponse().getContentAsString();
        Path zielPfad = Path.of("target", "openapi.json");
        Files.createDirectories(zielPfad.getParent());
        Files.writeString(zielPfad, json);

        // Verifiziere dass die Datei gueltig ist und Pfade enthaelt
        assert json.contains("\"paths\"") : "OpenAPI-Spec muss Pfade enthalten";
        assert json.contains("/api/tische") : "OpenAPI-Spec muss Tisch-Endpunkte enthalten";
        assert json.contains("\"schemas\"") : "OpenAPI-Spec muss Schemas enthalten";
    }
}
