package de.locodoko.partie;

import de.locodoko.karten.Hand;
import de.locodoko.karten.Kartendeck;
import de.locodoko.karten.Spielregeln;
import de.locodoko.karten.Spieltyp;
import de.locodoko.karten.TrumpfOrdnung;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.Objects;

class SpielBuilder {
    Spielregeln spielregeln;
    Kartendeck kartendeck;
    TrumpfOrdnung trumpfOrdnung;
    Spieltyp spieltyp;
    SpielerPosition geber;
    Spielphase phase;
    Map<SpielerPosition, Hand> haende;
    List<VorbehaltMeldung> vorbehalte;
    Parteien parteien;
    Ansagen ansagen;
    List<Stich> abgeschlosseneStiche;
    Spielergebnis ergebnis;
    SpielerPosition solistAufspieler;
    Set<SpielerPosition> bereitsGeschmissen;
    int einwurfZaehler;
    UUID persistenceId;
    Instant persistenceErstelltAm;
    Instant persistenceAktualisiertAm;
    boolean persistenceIsNew = true;

    SpielBuilder spielregeln(Spielregeln v) { this.spielregeln = v; return this; }
    SpielBuilder kartendeck(Kartendeck v) { this.kartendeck = v; return this; }
    SpielBuilder trumpfOrdnung(TrumpfOrdnung v) { this.trumpfOrdnung = v; return this; }
    SpielBuilder spieltyp(Spieltyp v) { this.spieltyp = v; return this; }
    SpielBuilder geber(SpielerPosition v) { this.geber = v; return this; }
    SpielBuilder phase(Spielphase v) { this.phase = v; return this; }
    SpielBuilder haende(Map<SpielerPosition, Hand> v) { this.haende = v; return this; }
    SpielBuilder vorbehalte(List<VorbehaltMeldung> v) { this.vorbehalte = v; return this; }
    SpielBuilder parteien(Parteien v) { this.parteien = v; return this; }
    SpielBuilder ansagen(Ansagen v) { this.ansagen = v; return this; }
    SpielBuilder abgeschlosseneStiche(List<Stich> v) { this.abgeschlosseneStiche = v; return this; }
    SpielBuilder ergebnis(Spielergebnis v) { this.ergebnis = v; return this; }
    SpielBuilder solistAufspieler(SpielerPosition v) { this.solistAufspieler = v; return this; }
    SpielBuilder bereitsGeschmissen(Set<SpielerPosition> v) { this.bereitsGeschmissen = v; return this; }
    SpielBuilder einwurfZaehler(int v) { this.einwurfZaehler = v; return this; }
    SpielBuilder persistenceId(UUID v) { this.persistenceId = v; return this; }
    SpielBuilder persistenceErstelltAm(Instant v) { this.persistenceErstelltAm = v; return this; }
    SpielBuilder persistenceAktualisiertAm(Instant v) { this.persistenceAktualisiertAm = v; return this; }
    SpielBuilder persistenceIsNew(boolean v) { this.persistenceIsNew = v; return this; }

    Spiel build() {
        Objects.requireNonNull(spielregeln, "spielregeln darf nicht null sein");
        Spiel spiel = new Spiel(spielregeln, kartendeck, trumpfOrdnung, spieltyp, geber, phase,
            haende, vorbehalte, parteien, ansagen, abgeschlosseneStiche, ergebnis, solistAufspieler);
        if (bereitsGeschmissen != null) { spiel.setzeBereitsGeschmissen(bereitsGeschmissen); }
        spiel.setzeEinwurfZaehler(einwurfZaehler);
        if (persistenceId != null) {
            spiel.setPersistenceId(persistenceId);
            spiel.setPersistenceErstelltAm(persistenceErstelltAm);
            spiel.setPersistenceAktualisiertAm(persistenceAktualisiertAm);
            if (!persistenceIsNew) spiel.markiereAlsGeladenInternal();
        }
        spiel.syncZuPersistenz();
        return spiel;
    }
}
