package de.locodoko.spielverwaltung.tisch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/partien")
public class PartieController {

    private static final Logger LOGGER = LoggerFactory.getLogger(PartieController.class);

    private final TischService tischService;

    public PartieController(TischService tischService) {
        this.tischService = tischService;
    }

    @GetMapping("/{id}/stand")
    public PartieStandAntwort gibPartieStand(@PathVariable UUID id) {
        LOGGER.info("Partiestand fuer Partie {} abgefragt", id);
        return tischService.ladePartieStand(id);
    }
}
