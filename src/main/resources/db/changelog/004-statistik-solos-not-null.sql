-- REFACTOR-DB-3: solos_pro_typ in spieler_statistik NOT NULL mit leerem Default
-- Erst bestehende NULLs auffüllen, dann Constraint setzen.
UPDATE spieler_statistik SET solos_pro_typ = '{}' WHERE solos_pro_typ IS NULL;
ALTER TABLE spieler_statistik ALTER COLUMN solos_pro_typ SET DEFAULT '{}';
ALTER TABLE spieler_statistik ALTER COLUMN solos_pro_typ SET NOT NULL;
