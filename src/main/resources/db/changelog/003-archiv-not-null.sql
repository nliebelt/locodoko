-- REFACTOR-DB-2: NOT NULL-Constraints fuer spielergebnis_archiv
-- Diese Spalten werden bei jedem abgeschlossenen Spiel immer gesetzt.
ALTER TABLE spielergebnis_archiv ALTER COLUMN re_augen SET NOT NULL;
ALTER TABLE spielergebnis_archiv ALTER COLUMN kontra_augen SET NOT NULL;
ALTER TABLE spielergebnis_archiv ALTER COLUMN sieger_partei SET NOT NULL;
ALTER TABLE spielergebnis_archiv ALTER COLUMN spielwert SET NOT NULL;
ALTER TABLE spielergebnis_archiv ALTER COLUMN grundwert SET NOT NULL;
