package de.locodoko.tisch;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.UUID;

@Service
public class TischEchtzeitService {

    private final SimpMessagingTemplate messagingTemplate;
    private final ApplicationEventPublisher eventPublisher;
    private final List<WebSocketNachrichtenBeobachter> beobachter;

    public TischEchtzeitService(
        SimpMessagingTemplate messagingTemplate,
        ApplicationEventPublisher eventPublisher,
        List<WebSocketNachrichtenBeobachter> beobachter
    ) {
        this.messagingTemplate = messagingTemplate;
        this.eventPublisher = eventPublisher;
        this.beobachter = List.copyOf(beobachter);
    }

    public void planeTischliste(TischlisteEreignisAntwort antwort) {
        planeNachCommit(() -> sendeBroadcast("/topic/tische", antwort));
    }

    public void planeTischEreignis(TischEreignisAntwort antwort) {
        planeNachCommit(() -> sendeBroadcast("/topic/tisch/" + antwort.tischId(), antwort));
    }

    public void planeTischVerbindungsStatus(UUID tischId, VerbindungStatusEreignisAntwort ereignis) {
        planeNachCommit(() -> sendeBroadcast("/topic/tisch/" + tischId, ereignis));
    }

    public void sendeAnBenutzer(String benutzer, String ziel, Object payload) {
        messagingTemplate.convertAndSendToUser(benutzer, ziel, payload);
        veroeffentlicheBeobachtung(WebSocketNachrichtGesendet.benutzerbezogen(benutzer, ziel, payload));
    }

    public void planeAnBenutzer(String benutzer, String ziel, Object payload) {
        planeNachCommit(() -> sendeAnBenutzer(benutzer, ziel, payload));
    }

    private void planeNachCommit(Runnable aktion) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    aktion.run();
                }
            });
            return;
        }
        aktion.run();
    }

    private void sendeBroadcast(String ziel, Object payload) {
        messagingTemplate.convertAndSend(ziel, payload);
        veroeffentlicheBeobachtung(WebSocketNachrichtGesendet.broadcast(ziel, payload));
    }

    private void veroeffentlicheBeobachtung(WebSocketNachrichtGesendet nachricht) {
        eventPublisher.publishEvent(nachricht);
        beobachter.forEach(eintrag -> eintrag.nachrichtGesendet(nachricht));
    }
}
