package de.locodoko.system;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SystemstatusControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void liefertSystemstatusMitProfil() throws Exception {
        mockMvc.perform(get("/api/system/status"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.anwendung").value("locodoko"))
            .andExpect(jsonPath("$.status").value("bereit"))
            .andExpect(jsonPath("$.aktivesProfil").value("dev"));
    }
}
