package de.locodoko.tisch;

import de.locodoko.partie.SonderpunktEreignis;
import de.locodoko.partie.SpielerPosition;
import de.locodoko.spieler.SpielerEntity;
import org.springframework.lang.Nullable;
import java.util.Map;

public record SonderpunktEreignisAntwort(
    String typ,
    SpielerPosition gewinner,
    @Nullable SpielerPosition verlierer
) {
    public static SonderpunktEreignisAntwort aus(SonderpunktEreignis ereignis, Map<SpielerPosition, SpielerEntity> spielerNachPosition) {
        return new SonderpunktEreignisAntwort(
            ereignis.art().name(),
            ereignis.taeter(),
            ereignis.opfer()
        );
    }
}
