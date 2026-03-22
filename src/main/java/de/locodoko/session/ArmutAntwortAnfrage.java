package de.locodoko.session;

import java.util.List;

public record ArmutAntwortAnfrage(boolean angenommen, List<String> kartenIds) {
}
