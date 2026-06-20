--liquibase formatted sql
--changeset locodoko:002-schema-fixes
-- 4 fehlende FK-Indizes + CHECK-Constraint auf spieler.authentifizierungs_methode

CREATE INDEX idx_partie_erstellt_von_spieler_id ON partie(erstellt_von_spieler_id);
CREATE INDEX idx_tisch_erstellt_von_spieler_id ON tisch(erstellt_von_spieler_id);
CREATE INDEX idx_laufendes_spiel_partie_id ON laufendes_spiel(partie_id);
CREATE INDEX idx_partie_teilnehmer_partie_id ON partie_teilnehmer(partie_id);

ALTER TABLE spieler ADD CONSTRAINT chk_spieler_auth_methode
    CHECK (authentifizierungs_methode IN ('PASSWORT', 'OAUTH2_GOOGLE'));
