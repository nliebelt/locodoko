package de.locodoko.partie.ereignisse;

import java.util.UUID;

/**
 * Domain Event: Der Partiestand hat sich geaendert. WebSocket-Subscriber senden einen Broadcast
 * an alle Clients dieses Tisches.
 */
public record PartieAktualisiert(UUID tischId) {}
