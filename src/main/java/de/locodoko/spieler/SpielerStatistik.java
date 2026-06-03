package de.locodoko.spieler;

import de.locodoko.system.AbstraktePersistenzEntity;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Spieler-Statistik, pro Regelvariante eine Zeile (Composite Key: spieler_id + regelvariante).
 * Append-only — wird niemals zurueckgesetzt.
 * Wird bei jedem abgeschlossenen Spiel via {@link SpielerProfilService} aktualisiert.
 */
@Table("spieler_statistik")
public class SpielerStatistik extends AbstraktePersistenzEntity {

    @Column("spieler_id")
    private UUID spielerId;

    @Column("regelvariante")
    private String regelvariante;

    @Column("anzahl_spiele")
    private int anzahlSpiele;

    @Column("anzahl_siege")
    private int anzahlSiege;

    @Column("gesamt_punkte")
    private int gesamtPunkte;

    @Column("fuchs_gefangen")
    private int fuchsGefangen;

    @Column("fuchs_verloren")
    private int fuchsVerloren;

    @Column("karlchen_gespielt")
    private int karlchenGespielt;

    @Column("doppelkoepfe")
    private int doppelkoepfe;

    @Column("re_siege")
    private int reSiege;

    @Column("re_niederlagen")
    private int reNiederlagen;

    @Column("kontra_siege")
    private int kontraSiege;

    @Column("kontra_niederlagen")
    private int kontraNiederlagen;

    @Column("schweinchen_gespielt")
    private int schweinchenGespielt;

    @Column("hochzeiten_gespielt")
    private int hochzeitenGespielt;

    @Column("armuten_angesagt")
    private int armutenAngesagt;

    @Column("armuten_uebernommen")
    private int armutenUebernommen;

    @Column("solos_siege")
    private int solosSiege;

    @Column("solos_niederlagen")
    private int solosNiederlagen;

    /** JSONB-Feld: Map<SoloTypName, {"siege": n, "niederlagen": m}>. */
    @Column("solos_pro_typ")
    private String solosProTypJson;

    @Column("gesamt_augen")
    private int gesamtAugen;

    @Column("zuletzt_aktualisiert")
    private Instant zuletztAktualisiert;

    protected SpielerStatistik() {
    }

    /** Erzeugt eine neue leere Statistik fuer den angegebenen Spieler und die Regelvariante. */
    public static SpielerStatistik fuer(UUID spielerId, String regelvariante) {
        SpielerStatistik statistik = new SpielerStatistik();
        statistik.spielerId = spielerId;
        statistik.regelvariante = regelvariante;
        statistik.solosProTypJson = "{}";
        return statistik;
    }

    public UUID spielerId() { return spielerId; }
    public String regelvariante() { return regelvariante; }
    public int anzahlSpiele() { return anzahlSpiele; }
    public int anzahlSiege() { return anzahlSiege; }
    public int gesamtPunkte() { return gesamtPunkte; }
    public int fuchsGefangen() { return fuchsGefangen; }
    public int fuchsVerloren() { return fuchsVerloren; }
    public int karlchenGespielt() { return karlchenGespielt; }
    public int doppelkoepfe() { return doppelkoepfe; }
    public int reSiege() { return reSiege; }
    public int reNiederlagen() { return reNiederlagen; }
    public int kontraSiege() { return kontraSiege; }
    public int kontraNiederlagen() { return kontraNiederlagen; }
    public int schweinchenGespielt() { return schweinchenGespielt; }
    public int hochzeitenGespielt() { return hochzeitenGespielt; }
    public int armutenAngesagt() { return armutenAngesagt; }
    public int armutenUebernommen() { return armutenUebernommen; }
    public int solosSiege() { return solosSiege; }
    public int solosNiederlagen() { return solosNiederlagen; }
    public String solosProTypJson() { return solosProTypJson; }
    public int gesamtAugen() { return gesamtAugen; }
    public Instant zuletztAktualisiert() { return zuletztAktualisiert; }

    /** Durchschnittliche Team-Augen pro Spiel (0.0 wenn noch kein Spiel). */
    public double durchschnittlicheAugenProSpiel() {
        return anzahlSpiele > 0 ? (double) gesamtAugen / anzahlSpiele : 0.0;
    }

    /**
     * Aktualisiert die Statistik nach einem abgeschlossenen Spiel.
     *
     * @param sieger              ob der Spieler gewonnen hat
     * @param spielpunkte         erzielte Spielpunkte
     * @param neuerFuchsGefangen  Anzahl gefangener Fuechse
     * @param neuerFuchsVerloren  Anzahl verlorener Fuechse
     * @param neuerKarlchenGespielt Anzahl Karlchen-Sonderpunkte
     * @param neueDoppelkoepfe    Anzahl Doppelkopf-Sonderpunkte
     * @param istSolist           ob der Spieler Solospieler war
     * @param istReSpieler        ob der Spieler in der Re-Partei war
     * @param spieltypName        Name des Spieltyps (leer fuer NORMALSPIEL)
     * @param hatArmutAngesagt    ob der Spieler Armut angesagt hat
     * @param hatArmutUebernommen ob der Spieler eine Armut uebernommen hat
     * @param teamAugen           Augen des Spielerteams in diesem Spiel
     */
    public void verarbeiteSpiel(boolean sieger, int spielpunkte, int neuerFuchsGefangen,
                                int neuerFuchsVerloren, int neuerKarlchenGespielt,
                                int neueDoppelkoepfe, boolean istSolist, boolean istReSpieler,
                                String spieltypName, boolean hatArmutAngesagt, boolean hatArmutUebernommen,
                                int teamAugen) {
        this.anzahlSpiele++;
        if (sieger) this.anzahlSiege++;
        this.gesamtPunkte += spielpunkte;
        this.gesamtAugen += teamAugen;
        this.fuchsGefangen += neuerFuchsGefangen;
        this.fuchsVerloren += neuerFuchsVerloren;
        this.karlchenGespielt += neuerKarlchenGespielt;
        this.doppelkoepfe += neueDoppelkoepfe;

        if (istReSpieler) {
            if (sieger) this.reSiege++; else this.reNiederlagen++;
        } else {
            if (sieger) this.kontraSiege++; else this.kontraNiederlagen++;
        }

        if ("HOCHZEIT".equals(spieltypName)) this.hochzeitenGespielt++;
        if (hatArmutAngesagt) this.armutenAngesagt++;
        if (hatArmutUebernommen) this.armutenUebernommen++;

        if (istSolist) {
            if (sieger) this.solosSiege++;
            else this.solosNiederlagen++;
            if (!spieltypName.isEmpty()) {
                inkrementieresolosProTyp(spieltypName, sieger);
            }
        }

        this.zuletztAktualisiert = Instant.now();
    }

    private void inkrementieresolosProTyp(String soloTypName, boolean sieger) {
        Map<String, Map<String, Integer>> solosMap = ladesolosProTyp();
        Map<String, Integer> typStats = solosMap.computeIfAbsent(soloTypName, k -> {
            Map<String, Integer> m = new HashMap<>();
            m.put("siege", 0);
            m.put("niederlagen", 0);
            return m;
        });
        if (sieger) {
            typStats.merge("siege", 1, Integer::sum);
        } else {
            typStats.merge("niederlagen", 1, Integer::sum);
        }
        speicheresolosProTyp(solosMap);
    }

    private Map<String, Map<String, Integer>> ladesolosProTyp() {
        if (solosProTypJson == null || solosProTypJson.isBlank()) {
            return new HashMap<>();
        }
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(solosProTypJson,
                mapper.getTypeFactory().constructMapType(Map.class,
                    mapper.getTypeFactory().constructType(String.class),
                    mapper.getTypeFactory().constructMapType(Map.class, String.class, Integer.class)));
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    private void speicheresolosProTyp(Map<String, Map<String, Integer>> solosMap) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            this.solosProTypJson = mapper.writeValueAsString(solosMap);
        } catch (Exception e) {
            // ignorieren — Statistik bleibt unveraendert
        }
    }
}
