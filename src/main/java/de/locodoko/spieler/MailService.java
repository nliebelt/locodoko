package de.locodoko.spieler;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

/**
 * Versendet transaktionale Emails (Email-Verifizierung, Passwort-Reset).
 * Env-gated: ohne SMTP_HOST sind alle Methoden No-Ops (kein Startup-Fehler, keine Exception).
 */
@Service
public class MailService {

    private static final Logger LOGGER = LoggerFactory.getLogger(MailService.class);

    private final Optional<JavaMailSender> mailSender;
    private final String smtpHost;
    private final String absender;
    private final String basisUrl;

    public MailService(
            Optional<JavaMailSender> mailSender,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${locodoko.mail.absender:noreply@locodoko.de}") String absender,
            @Value("${locodoko.mail.basis-url:http://localhost:8081}") String basisUrl) {
        this.mailSender = mailSender;
        this.smtpHost = smtpHost;
        this.absender = absender;
        this.basisUrl = basisUrl;
    }

    /** Gibt {@code true} zurueck, wenn Email-Versand konfiguriert ist (SMTP_HOST gesetzt). */
    public boolean istAktiv() {
        return smtpHost != null && !smtpHost.isBlank() && mailSender.isPresent();
    }

    /**
     * Sendet eine Email zur Bestätigung der Email-Adresse (Double-Opt-In).
     * No-Op falls SMTP nicht konfiguriert.
     */
    public void sendeVerifizierungsEmail(String empfaenger, String token) {
        if (!istAktiv()) {
            LOGGER.debug("SMTP nicht konfiguriert — Email-Verifizierung übersprungen für {}", empfaenger);
            return;
        }
        String link = basisUrl + "/api/auth/email-verifizieren?token=" + token;
        String betreff = "Locodoko — Email-Adresse bestätigen";
        String html = """
            <p>Hallo,</p>
            <p>bitte bestätige deine Email-Adresse für Locodoko durch Klick auf folgenden Link:</p>
            <p><a href="%s">Email-Adresse bestätigen</a></p>
            <p>Der Link ist unbegrenzt gültig.</p>
            <p>Falls du dich nicht bei Locodoko registriert hast, ignoriere diese Email.</p>
            """.formatted(link);
        sende(empfaenger, betreff, html);
    }

    /**
     * Sendet eine Email mit Passwort-Reset-Link (TTL 30 Minuten).
     * No-Op falls SMTP nicht konfiguriert.
     */
    public void sendePasswortResetEmail(String empfaenger, String token) {
        if (!istAktiv()) {
            LOGGER.debug("SMTP nicht konfiguriert — Passwort-Reset-Email übersprungen für {}", empfaenger);
            return;
        }
        String link = basisUrl + "/api/auth/passwort-reset?token=" + token;
        String betreff = "Locodoko — Passwort zurücksetzen";
        String html = """
            <p>Hallo,</p>
            <p>du hast eine Passwort-Zurücksetzung für dein Locodoko-Konto angefordert.</p>
            <p><a href="%s">Neues Passwort festlegen</a></p>
            <p>Dieser Link ist 30 Minuten gültig.</p>
            <p>Falls du kein neues Passwort angefordert hast, ignoriere diese Email.</p>
            """.formatted(link);
        sende(empfaenger, betreff, html);
    }

    private void sende(String empfaenger, String betreff, String htmlInhalt) {
        mailSender.ifPresent(sender -> {
            try {
                MimeMessage nachricht = sender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(nachricht, false, "UTF-8");
                helper.setFrom(absender);
                helper.setTo(empfaenger);
                helper.setSubject(betreff);
                helper.setText(htmlInhalt, true);
                sender.send(nachricht);
                LOGGER.info("Email versendet [empfaenger={}, betreff={}]", empfaenger, betreff);
            } catch (MessagingException e) {
                LOGGER.error("Email-Versand fehlgeschlagen [empfaenger={}, betreff={}]: {}", empfaenger, betreff, e.getMessage());
            }
        });
    }
}
