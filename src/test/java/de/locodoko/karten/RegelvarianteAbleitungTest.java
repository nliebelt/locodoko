package de.locodoko.karten;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit-Tests fuer die Ableitung der {@link Regelvariante} aus {@link Spielregeln}.
 */
class RegelvarianteAbleitungTest {

    @Test
    void dkvRegelnLiefernTURNIER() {
        assertThat(Spielregeln.dkvRegeln().regelvariante()).isEqualTo(Regelvariante.TURNIER);
    }

    @Test
    void locoBlatRegelnLiefernSONDER() {
        assertThat(Spielregeln.locoBlatRegeln().regelvariante()).isEqualTo(Regelvariante.SONDER);
    }

    @Test
    void ohneNeunenRegelnLiefernSONDER() {
        assertThat(Spielregeln.ohneNeunenRegeln().regelvariante()).isEqualTo(Regelvariante.SONDER);
    }

    @Test
    void individuelleAenderungLiefernFREI() {
        Spielregeln angepasst = Spielregeln.dkvRegeln().mitBockrundenAktiv(true);
        assertThat(angepasst.regelvariante()).isEqualTo(Regelvariante.FREI);
    }

    @Test
    void weitereAnpassungAnLocoBlatLiefernFREI() {
        // locoBlatRegeln hat herzDurchgegangenNurHoch=false; mit true ergibt sich kein Preset
        Spielregeln angepasst = Spielregeln.locoBlatRegeln().mitHerzDurchgegangenNurHoch(true);
        assertThat(angepasst.regelvariante()).isEqualTo(Regelvariante.FREI);
    }
}
