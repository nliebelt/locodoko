package de.locodoko.spielverwaltung.websocket;

import java.util.List;

public record ArmutAntwortAnfrage(boolean angenommen, List<String> kartenIds) {
}
