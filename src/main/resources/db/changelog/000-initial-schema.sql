--liquibase formatted sql
--changeset locodoko:000-initial-schema
-- Full schema

CREATE TABLE spieler (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    session_id VARCHAR(255) UNIQUE,
    ki BOOLEAN NOT NULL DEFAULT FALSE,
    external_id VARCHAR(255),
    ki_uebernommen BOOLEAN NOT NULL DEFAULT FALSE,
    passwort_hash VARCHAR(255),
    authentifizierungs_methode VARCHAR(50),
    benutzername VARCHAR(100),
    email VARCHAR(255),
    anzeige_name VARCHAR(100),
    avatar_farbe VARCHAR(50),
    erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    aktualisiert_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- UNIQUE-Constraints auf benutzername und email.
-- SQL-Standard: NULL != NULL in UNIQUE-Constraints → mehrere OAuth2-Spieler (benutzername/email = NULL) sind erlaubt.
CREATE UNIQUE INDEX spieler_benutzername_unique ON spieler(benutzername);
CREATE UNIQUE INDEX spieler_email_unique ON spieler(email);

CREATE TABLE partie (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    anzahl_spiele INT NOT NULL,
    aktuelles_spiel_nummer INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    punkte_sued INT NOT NULL DEFAULT 0,
    punkte_west INT NOT NULL DEFAULT 0,
    punkte_nord INT NOT NULL DEFAULT 0,
    punkte_ost INT NOT NULL DEFAULT 0,
    bockrunden_zaehler INT NOT NULL DEFAULT 0,
    solist_des_letzten_spiels VARCHAR(10),
    naechster_geber VARCHAR(10),
    regelvariante VARCHAR(20) NOT NULL,
    spielregeln JSONB NOT NULL,
    erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    aktualisiert_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    beendet_am TIMESTAMP WITH TIME ZONE,
    erstellt_von_spieler_id UUID REFERENCES spieler(id) ON DELETE SET NULL
);

CREATE TABLE tisch (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'WARTEND',
    partie_id UUID REFERENCES partie(id),
    ohne_neunen BOOLEAN NOT NULL DEFAULT FALSE,
    anzahl_spiele INT NOT NULL DEFAULT 24,
    tischhintergrund VARCHAR(50),
    hochzeit_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
    armut_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
    damensolo_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
    bubensolo_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
    fleischlos_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
    trumpfsolo_erlaubt BOOLEAN NOT NULL DEFAULT TRUE,
    zweite_dulle_sticht BOOLEAN NOT NULL DEFAULT TRUE,
    fuchs_gefangen_aktiv BOOLEAN NOT NULL DEFAULT TRUE,
    karlchen_aktiv BOOLEAN NOT NULL DEFAULT TRUE,
    doppelkopf_aktiv BOOLEAN NOT NULL DEFAULT TRUE,
    mindestkarten_re_kontra INT NOT NULL DEFAULT 11,
    mindestkarten_keine90 INT NOT NULL DEFAULT 10,
    mindestkarten_keine60 INT NOT NULL DEFAULT 9,
    mindestkarten_keine30 INT NOT NULL DEFAULT 8,
    mindestkarten_schwarz INT NOT NULL DEFAULT 7,
    ki_schwierigkeit VARCHAR(30),
    bockrunden_aktiv BOOLEAN NOT NULL DEFAULT FALSE,
    schweinchen_aktiv BOOLEAN NOT NULL DEFAULT FALSE,
    dreissig_augen_pflicht_aktiv BOOLEAN NOT NULL DEFAULT FALSE,
    schmeissen_aktiv BOOLEAN NOT NULL DEFAULT FALSE,
    herz_durchgegangen_nur_hoch BOOLEAN NOT NULL DEFAULT FALSE,
    einladungs_code VARCHAR(20),
    zugangsmodus VARCHAR(30) NOT NULL DEFAULT 'OFFEN',
    erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    aktualisiert_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    erstellt_von_spieler_id UUID REFERENCES spieler(id) ON DELETE SET NULL
);

CREATE TABLE tisch_spieler (
    tisch_id UUID NOT NULL REFERENCES tisch(id) ON DELETE CASCADE,
    spieler_id UUID NOT NULL REFERENCES spieler(id) ON DELETE CASCADE,
    tisch_spieler_key VARCHAR(10) NOT NULL,
    PRIMARY KEY (tisch_id, spieler_id)
);

CREATE TABLE laufendes_spiel (
    id UUID PRIMARY KEY,
    partie_id UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
    spiel_nummer INT NOT NULL,
    geber_position VARCHAR(10) NOT NULL,
    spieltyp VARCHAR(30) NOT NULL,
    phase JSONB NOT NULL DEFAULT '{"typ":"VORBEHALT_ANSAGE"}',
    trumpf_ordnung_typ JSONB NOT NULL DEFAULT '{"typ":"NORMAL"}',
    einwurf_zaehler INT NOT NULL DEFAULT 0,
    solist_aufspieler VARCHAR(10),
    spielregeln JSONB NOT NULL,
    haende JSONB NOT NULL DEFAULT '{}',
    vorbehalt_meldungen JSONB NOT NULL DEFAULT '[]',
    partei_zuordnungen JSONB,
    ansage_ereignisse JSONB NOT NULL DEFAULT '{"ereignisse":[]}',
    abgeschlossene_stiche JSONB NOT NULL DEFAULT '[]',
    bereits_geschmissen JSONB NOT NULL DEFAULT '[]',
    kartendeck JSONB,
    ergebnis JSONB,
    erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    aktualisiert_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(partie_id, spiel_nummer)
);

CREATE TABLE spielergebnis_archiv (
    id UUID PRIMARY KEY,
    partie_id UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
    spiel_nummer INT NOT NULL,
    geber_position VARCHAR(10) NOT NULL,
    spieltyp VARCHAR(30) NOT NULL,
    ist_solo BOOLEAN NOT NULL DEFAULT FALSE,
    solo_typ VARCHAR(30),
    re_augen INT,
    kontra_augen INT,
    sieger_partei VARCHAR(10),
    spielwert INT,
    grundwert INT,
    absage_punkte INT NOT NULL DEFAULT 0,
    gegen_die_alten_punkte INT NOT NULL DEFAULT 0,
    solo_multiplikator INT NOT NULL DEFAULT 0,
    spielpunkte_sued INT NOT NULL DEFAULT 0,
    spielpunkte_west INT NOT NULL DEFAULT 0,
    spielpunkte_nord INT NOT NULL DEFAULT 0,
    spielpunkte_ost INT NOT NULL DEFAULT 0,
    abgeschlossen_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(partie_id, spiel_nummer)
);

CREATE TABLE sonderpunkt_eintrag (
    id UUID PRIMARY KEY,
    spielergebnis_archiv_id UUID NOT NULL REFERENCES spielergebnis_archiv(id) ON DELETE CASCADE,
    partei VARCHAR(10) NOT NULL,
    sonderpunkt_typ VARCHAR(50) NOT NULL,
    taeter_position VARCHAR(10),
    opfer_position VARCHAR(10)
);

CREATE TABLE partie_teilnehmer (
    id UUID PRIMARY KEY,
    partie_id UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
    spieler_id UUID REFERENCES spieler(id) ON DELETE SET NULL,
    spieler_position VARCHAR(10) NOT NULL,
    beigetreten_am TIMESTAMP WITH TIME ZONE,
    ausgeschieden_am TIMESTAMP WITH TIME ZONE,
    UNIQUE(partie_id, spieler_position)
);

CREATE TABLE spieler_statistik (
    id UUID PRIMARY KEY,
    spieler_id UUID NOT NULL REFERENCES spieler(id) ON DELETE CASCADE,
    regelvariante VARCHAR(20) NOT NULL DEFAULT 'FREI',
    anzahl_spiele INT NOT NULL DEFAULT 0,
    anzahl_siege INT NOT NULL DEFAULT 0,
    gesamt_punkte INT NOT NULL DEFAULT 0,
    fuchs_gefangen INT NOT NULL DEFAULT 0,
    fuchs_verloren INT NOT NULL DEFAULT 0,
    karlchen_gespielt INT NOT NULL DEFAULT 0,
    doppelkoepfe INT NOT NULL DEFAULT 0,
    re_siege INT NOT NULL DEFAULT 0,
    re_niederlagen INT NOT NULL DEFAULT 0,
    kontra_siege INT NOT NULL DEFAULT 0,
    kontra_niederlagen INT NOT NULL DEFAULT 0,
    schweinchen_gespielt INT NOT NULL DEFAULT 0,
    hochzeiten_gespielt INT NOT NULL DEFAULT 0,
    armuten_angesagt INT NOT NULL DEFAULT 0,
    armuten_uebernommen INT NOT NULL DEFAULT 0,
    solos_siege INT NOT NULL DEFAULT 0,
    solos_niederlagen INT NOT NULL DEFAULT 0,
    solos_pro_typ JSONB,
    zuletzt_aktualisiert TIMESTAMP WITH TIME ZONE,
    erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    aktualisiert_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(spieler_id, regelvariante)
);

CREATE TABLE event_publication (
    id UUID PRIMARY KEY,
    listener_id VARCHAR(512) NOT NULL,
    event_type VARCHAR(512) NOT NULL,
    serialized_event TEXT NOT NULL,
    publication_date TIMESTAMP WITH TIME ZONE NOT NULL,
    completion_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20),
    completion_attempts INT,
    last_resubmission_date TIMESTAMP WITH TIME ZONE
);

CREATE INDEX event_publication_by_listener_id_and_serialized_event_idx
    ON event_publication (listener_id, serialized_event);

-- partie_ergebnis_view: Berechnet Partiehistorie live aus partie + partie_teilnehmer + tisch.
-- Loest die alte partie_ergebnis-Tabelle (max-20-Rotation) ab — keine Schreiblogik mehr noetig.
CREATE VIEW partie_ergebnis_view AS
SELECT
    pt.spieler_id,
    p.id                         AS partie_id,
    t.name                       AS tisch_name,
    p.beendet_am                 AS datum,
    p.regelvariante,
    CASE pt.spieler_position
        WHEN 'SUED' THEN p.punkte_sued
        WHEN 'WEST' THEN p.punkte_west
        WHEN 'NORD' THEN p.punkte_nord
        WHEN 'OST'  THEN p.punkte_ost
        ELSE 0
    END                          AS end_punktestand,
    RANK() OVER (
        PARTITION BY p.id
        ORDER BY CASE pt.spieler_position
            WHEN 'SUED' THEN p.punkte_sued
            WHEN 'WEST' THEN p.punkte_west
            WHEN 'NORD' THEN p.punkte_nord
            WHEN 'OST'  THEN p.punkte_ost
            ELSE 0
        END DESC
    )                            AS rangplatz,
    p.aktuelles_spiel_nummer     AS spielanzahl
FROM partie p
JOIN partie_teilnehmer pt ON pt.partie_id = p.id
LEFT JOIN tisch t ON t.partie_id = p.id
WHERE p.status = 'BEENDET';
