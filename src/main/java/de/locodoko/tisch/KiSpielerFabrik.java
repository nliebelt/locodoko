package de.locodoko.tisch;

import de.locodoko.spieler.SpielerEntity;
import de.locodoko.spieler.SpielerRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Erzeugt persistierte KI-Spieler-Instanzen mit eindeutigen Namen.
 *
 * <p>Wird beim Tischstart verwendet, um fehlende menschliche Spieler durch KI-Spieler
 * aufzufuellen. KI-Namen werden aus einer festen Basisliste gewaehlt und bei Bedarf
 * mit einem numerischen Suffix eindeutig gemacht. KI-Spieler haben keine HTTP-Session.</p>
 */
@Component
public class KiSpielerFabrik {

    private static final List<String> BASISNAMEN = List.of(
        "KI Anna",
        "KI Bob",
        "KI Clara",
        "KI Dora",
        "KI Emil",
        "KI Frieda",
        "KI Gustav",
        "KI Heidi"
    );

    private final SpielerRepository spielerRepository;

    public KiSpielerFabrik(SpielerRepository spielerRepository) {
        this.spielerRepository = spielerRepository;
    }

    @Transactional
    public SpielerEntity erzeugeNaechstenSpieler() {
        Set<String> vergebeneNamen = spielerRepository.findAllByKiTrueOrderByErstelltAmAsc()
            .stream()
            .map(SpielerEntity::name)
            .collect(Collectors.toSet());

        return spielerRepository.saveAndFlush(SpielerEntity.ki(bestimmeNaechstenNamen(vergebeneNamen)));
    }

    String bestimmeNaechstenNamen(Set<String> vergebeneNamen) {
        for (String basisname : BASISNAMEN) {
            if (!vergebeneNamen.contains(basisname)) {
                return basisname;
            }
        }

        int suffix = 2;
        while (true) {
            for (String basisname : BASISNAMEN) {
                String kandidat = basisname + " " + suffix;
                if (!vergebeneNamen.contains(kandidat)) {
                    return kandidat;
                }
            }
            suffix++;
        }
    }
}
