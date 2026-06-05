package de.locodoko.spieler;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Nimmt In-App-Bugreports entgegen, reichert sie mit Log-Ausschnitten an
 * und erstellt optional ein GitHub-Issue im privaten Bugreport-Repo.
 * Auth erforderlich — kein anonymes Melden.
 */
@Tag(name = "BugReport", description = "In-App-Bugreport")
@RestController
@RequestMapping("/api/bugreport")
public class BugReportController {

    private static final Logger LOGGER = LoggerFactory.getLogger(BugReportController.class);
    private static final int MAX_LOG_ZEILEN = 300;
    private static final Path LOG_PFAD = Path.of("logs/locodoko.log");

    private final SpielerSessionService spielerSessionService;
    private final ObjectMapper objectMapper;

    @Value("${locodoko.bugreport.github-token:}")
    private String githubToken;

    @Value("${locodoko.bugreport.github-repo:}")
    private String githubRepo;

    @Value("${locodoko.bugreport.loki-base-url:}")
    private String lokiBaseUrl;

    public BugReportController(SpielerSessionService spielerSessionService, ObjectMapper objectMapper) {
        this.spielerSessionService = spielerSessionService;
        this.objectMapper = objectMapper;
    }

    @Operation(summary = "Bug-Report einreichen", description = "Auth erforderlich. GitHub-Issue-Anlage env-gated (LOCODOKO_BUGREPORT_GITHUB_TOKEN + _GITHUB_REPO).")
    @PostMapping
    public ResponseEntity<BugReportAntwort> einreichen(
            @Valid @RequestBody BugReportAnfrage anfrage,
            HttpServletRequest request) {

        SpielerEntity spieler = spielerSessionService.ladeAktivenSpieler(request);

        LOGGER.info("BUGREPORT: spieler={} schweregrad={} tischId={} partieId={} korrelationsIds={}",
                spieler.id(), anfrage.schweregrad(), anfrage.tischId(), anfrage.partieId(),
                anfrage.correlationIds());

        String logAusschnitt = leseLogAusschnitt(anfrage.correlationIds());
        String lokiDeepLink = erzeugeLokiDeepLink(anfrage.correlationIds());
        String issueUrl = null;

        if (istGithubKonfiguriert()) {
            issueUrl = erstelleGithubIssue(spieler, anfrage, logAusschnitt, lokiDeepLink, request);
        }

        return ResponseEntity.ok(new BugReportAntwort(issueUrl));
    }

    private String leseLogAusschnitt(List<String> correlationIds) {
        if (correlationIds == null || correlationIds.isEmpty() || !Files.exists(LOG_PFAD)) {
            return "";
        }
        try {
            List<String> alleZeilen = Files.readAllLines(LOG_PFAD);
            int von = Math.max(0, alleZeilen.size() - MAX_LOG_ZEILEN);
            return alleZeilen.subList(von, alleZeilen.size()).stream()
                    .filter(z -> correlationIds.stream().anyMatch(z::contains))
                    .collect(Collectors.joining("\n"));
        } catch (IOException e) {
            LOGGER.warn("Log-Ausschnitt konnte nicht gelesen werden: {}", e.getMessage());
            return "";
        }
    }

    private String erzeugeLokiDeepLink(List<String> correlationIds) {
        if (lokiBaseUrl == null || lokiBaseUrl.isBlank()
                || correlationIds == null || correlationIds.isEmpty()) {
            return null;
        }
        String idMuster = correlationIds.stream()
                .map(id -> id.replaceAll("[^a-zA-Z0-9\\-]", ""))
                .collect(Collectors.joining("|"));
        String query = "{job=\"locodoko\"} | json | correlationId=~\"" + idMuster + "\"";
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
        return lokiBaseUrl + "/explore?orgId=1&left=%7B%22queries%22:%5B%7B%22expr%22:%22"
                + encodedQuery + "%22%7D%5D%7D";
    }

    private boolean istGithubKonfiguriert() {
        return githubToken != null && !githubToken.isBlank()
                && githubRepo != null && !githubRepo.isBlank();
    }

    private String erstelleGithubIssue(SpielerEntity spieler, BugReportAnfrage anfrage,
                                        String logAusschnitt, String lokiDeepLink,
                                        HttpServletRequest request) {
        try {
            String kurzBeschreibung = anfrage.beschreibung().length() > 60
                    ? anfrage.beschreibung().substring(0, 60) + "…"
                    : anfrage.beschreibung();
            String titel = "[Bug/" + anfrage.schweregrad() + "] " + kurzBeschreibung;

            String sessionId = request.getSession(false) != null
                    ? request.getSession(false).getId() : "-";

            StringBuilder body = new StringBuilder();
            body.append("## Bug-Report\n\n");
            body.append("| Feld | Wert |\n|---|---|\n");
            body.append("| Zeitpunkt | ").append(Instant.now()).append(" |\n");
            body.append("| Schweregrad | ").append(anfrage.schweregrad()).append(" |\n");
            body.append("| Spieler-ID | ").append(spieler.id()).append(" |\n");
            body.append("| Session-ID | ").append(sessionId).append(" |\n");
            body.append("| Tisch | ").append(nullSafe(anfrage.tischId())).append(" |\n");
            body.append("| Partie | ").append(nullSafe(anfrage.partieId())).append(" |\n");
            body.append("| Build | ").append(nullSafe(anfrage.buildSha())).append(" |\n");
            body.append("| User-Agent | ").append(nullSafe(anfrage.userAgent())).append(" |\n");
            body.append("| Viewport | ").append(nullSafe(anfrage.viewport())).append(" |\n\n");
            body.append("## Beschreibung\n\n").append(anfrage.beschreibung()).append("\n\n");

            if (anfrage.correlationIds() != null && !anfrage.correlationIds().isEmpty()) {
                body.append("## Correlation-IDs\n\n```\n")
                    .append(String.join("\n", anfrage.correlationIds()))
                    .append("\n```\n\n");
            }
            if (lokiDeepLink != null) {
                body.append("## Loki-Deep-Link\n\n[Logs in Grafana öffnen](")
                    .append(lokiDeepLink).append(")\n\n");
            }
            if (!logAusschnitt.isEmpty()) {
                // Auf 4000 Zeichen kürzen, damit GitHub-Limit nicht überschritten wird
                String gekuerzt = logAusschnitt.length() > 4000
                        ? "…(gekürzt)\n" + logAusschnitt.substring(logAusschnitt.length() - 4000)
                        : logAusschnitt;
                body.append("## Log-Ausschnitt (letzte Einträge mit correlationId)\n\n```\n")
                    .append(gekuerzt).append("\n```\n\n");
            }
            if (anfrage.zustandZusammenfassung() != null && !anfrage.zustandZusammenfassung().isBlank()) {
                body.append("## Zustand (redigiert)\n\n```json\n")
                    .append(anfrage.zustandZusammenfassung()).append("\n```\n");
            }

            var payload = objectMapper.writeValueAsString(Map.of(
                    "title", titel,
                    "body", body.toString(),
                    "labels", List.of("bug", "in-app-report")));

            var antwort = RestClient.create().post()
                    .uri("https://api.github.com/repos/" + githubRepo + "/issues")
                    .header("Authorization", "Bearer " + githubToken)
                    .header("Accept", "application/vnd.github.v3+json")
                    .header("Content-Type", "application/json")
                    .body(payload)
                    .retrieve()
                    .toEntity(String.class);

            if (antwort.getStatusCode().is2xxSuccessful() && antwort.getBody() != null) {
                return objectMapper.readTree(antwort.getBody()).path("html_url").asText(null);
            }
        } catch (Exception e) {
            LOGGER.warn("GitHub-Issue konnte nicht erstellt werden: {}", e.getMessage());
        }
        return null;
    }

    private static String nullSafe(String wert) {
        return wert != null ? wert : "-";
    }

    public record BugReportAnfrage(
        @NotBlank(message = "Beschreibung darf nicht leer sein")
        @Size(max = 3000, message = "Beschreibung maximal 3000 Zeichen")
        String beschreibung,
        @NotBlank(message = "Schweregrad darf nicht leer sein")
        String schweregrad,
        List<String> correlationIds,
        String tischId,
        String partieId,
        String userAgent,
        String viewport,
        String buildSha,
        @Size(max = 5000)
        String zustandZusammenfassung
    ) {}

    public record BugReportAntwort(String issueUrl) {}
}
