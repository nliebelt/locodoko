package de.locodoko.system;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system")
public class SystemstatusController {

    private final String aktivesProfil;

    public SystemstatusController(@Value("${spring.profiles.active:${spring.profiles.default:default}}") String aktivesProfil) {
        this.aktivesProfil = aktivesProfil;
    }

    @GetMapping("/status")
    public SystemstatusAntwort status() {
        return new SystemstatusAntwort("locodoko", "bereit", aktivesProfil);
    }
}
