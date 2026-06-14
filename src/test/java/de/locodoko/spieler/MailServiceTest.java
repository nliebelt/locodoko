package de.locodoko.spieler;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessagePreparator;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

/**
 * Unit-Tests fuer MailService.
 * Wichtig: Ohne SMTP-Konfiguration darf kein Fehler geworfen werden (No-Op-Verhalten).
 */
class MailServiceTest {

    @Test
    void ohneSmtpHost_istNichtAktiv() {
        var service = new MailService(Optional.empty(), "", "noreply@test.de", "http://localhost");
        assertThat(service.istAktiv()).isFalse();
    }

    @Test
    void ohneMailSender_istNichtAktivTrotzHost() {
        // smtpHost gesetzt, aber kein JavaMailSender (z.B. Bean-Konfiguration fehlt)
        var service = new MailService(Optional.empty(), "smtp.example.com", "noreply@test.de", "http://localhost");
        assertThat(service.istAktiv()).isFalse();
    }

    @Test
    void mitSmtpHostUndSender_istAktiv() {
        var sender = new FakeMailSender();
        var service = new MailService(Optional.of(sender), "smtp.example.com", "noreply@test.de", "http://localhost");
        assertThat(service.istAktiv()).isTrue();
    }

    @Test
    void ohneSmtp_verifikationsEmailIstNoOp() {
        var service = new MailService(Optional.empty(), "", "noreply@test.de", "http://localhost");
        assertThatNoException().isThrownBy(
                () -> service.sendeVerifizierungsEmail("empfaenger@example.com", "token-abc"));
    }

    @Test
    void ohneSmtp_passwortResetEmailIstNoOp() {
        var service = new MailService(Optional.empty(), "", "noreply@test.de", "http://localhost");
        assertThatNoException().isThrownBy(
                () -> service.sendePasswortResetEmail("empfaenger@example.com", "reset-xyz"));
    }

    @Test
    void mitSmtp_sendeVerifizierungsEmail_versendetGenauEineNachricht() {
        var sender = new FakeMailSender();
        var service = new MailService(Optional.of(sender), "smtp.example.com", "noreply@locodoko.de", "https://zock.locodoko.de");

        service.sendeVerifizierungsEmail("spieler@example.com", "mein-token-123");

        assertThat(sender.gesendeteNachrichten).hasSize(1);
    }

    @Test
    void mitSmtp_sendePasswortResetEmail_versendetGenauEineNachricht() {
        var sender = new FakeMailSender();
        var service = new MailService(Optional.of(sender), "smtp.example.com", "noreply@locodoko.de", "https://zock.locodoko.de");

        service.sendePasswortResetEmail("spieler@example.com", "reset-token-456");

        assertThat(sender.gesendeteNachrichten).hasSize(1);
    }

    /**
     * Einfache Fake-Implementierung von JavaMailSender fuer Unit-Tests.
     * Speichert gesendete MimeMessages statt sie wirklich zu versenden.
     */
    static class FakeMailSender implements JavaMailSender {

        final List<MimeMessage> gesendeteNachrichten = new ArrayList<>();
        private final Session session = Session.getInstance(new Properties());

        @Override
        public MimeMessage createMimeMessage() {
            return new MimeMessage(session);
        }

        @Override
        public MimeMessage createMimeMessage(InputStream contentStream) throws MailException {
            throw new UnsupportedOperationException();
        }

        @Override
        public void send(MimeMessage mimeMessage) throws MailException {
            gesendeteNachrichten.add(mimeMessage);
        }

        @Override
        public void send(MimeMessage... mimeMessages) throws MailException {
            for (MimeMessage m : mimeMessages) {
                gesendeteNachrichten.add(m);
            }
        }

        @Override
        public void send(MimeMessagePreparator mimeMessagePreparator) throws MailException {
            throw new UnsupportedOperationException();
        }

        @Override
        public void send(MimeMessagePreparator... mimeMessagePreparators) throws MailException {
            throw new UnsupportedOperationException();
        }

        @Override
        public void send(SimpleMailMessage simpleMessage) throws MailException {
            throw new UnsupportedOperationException();
        }

        @Override
        public void send(SimpleMailMessage... simpleMessages) throws MailException {
            throw new UnsupportedOperationException();
        }
    }
}
