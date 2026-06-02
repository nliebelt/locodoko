-- REFACTOR-DB-1: Fehlende Indizes auf FK-Spalten
-- Abfrageperformance bei Spielerhistorie, Partiehistorie und Sonderpunkten.
CREATE INDEX idx_tisch_partie_id
    ON tisch (partie_id);

CREATE INDEX idx_partie_teilnehmer_spieler_id
    ON partie_teilnehmer (spieler_id);

CREATE INDEX idx_spieler_statistik_spieler_id
    ON spieler_statistik (spieler_id);

CREATE INDEX idx_spielergebnis_archiv_partie_id
    ON spielergebnis_archiv (partie_id);

CREATE INDEX idx_sonderpunkt_eintrag_spielergebnis_archiv_id
    ON sonderpunkt_eintrag (spielergebnis_archiv_id);
