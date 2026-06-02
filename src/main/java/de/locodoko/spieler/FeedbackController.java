package de.locodoko.spieler;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
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

import java.time.Instant;

/**
 * Nimmt Beta-Feedback entgegen und schreibt es ins Application-Log.
 * Optional: Weiterleitun an Discord-Webhook via LOCODOKO_FEEDBACK_WEBHOOK_URL.
 */
@Tag(name = "Feedback", description = "Beta-Feedback")
@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private static final Logger LOGGER = LoggerFactory.getLogger(FeedbackController.class);

    @Value("${locodoko.feedback.webhook-url:}")
    private String webhookUrl;

    @Operation(summary = "Feedback einreichen", description = "Schreibt Feedback ins Log, optional an Discord-Webhook.")
    @ApiResponse(responseCode = "200", description = "Feedback erhalten")
    @PostMapping
    public ResponseEntity<Void> einreichen(@Valid @RequestBody FeedbackAnfrage anfrage) {
        LOGGER.info("FEEDBACK: {}", anfrage.text());

        if (webhookUrl != null && !webhookUrl.isBlank()) {
            try {
                var body = "{\"content\": \"**Feedback (" + Instant.now() + "):**\\n" +
                    anfrage.text().replace("\"", "\\\"").replace("\n", "\\n") + "\"}";
                RestClient.create().post()
                    .uri(webhookUrl)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            } catch (Exception e) {
                LOGGER.warn("Webhook-Versand fehlgeschlagen: {}", e.getMessage());
            }
        }

        return ResponseEntity.ok().build();
    }

    public record FeedbackAnfrage(
        @NotBlank(message = "Feedback darf nicht leer sein")
        @Size(max = 2000, message = "Feedback maximal 2000 Zeichen")
        String text
    ) {}
}
