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
    erstellt_am TIMESTAMP WITH TIME ZONE,
    aktualisiert_am TIMESTAMP WITH TIME ZONE
);

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
    regelvariante VARCHAR(20),
    spielregeln JSONB,
    erstellt_am TIMESTAMP WITH TIME ZONE,
    aktualisiert_am TIMESTAMP WITH TIME ZONE
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
    zugangsmodus VARCHAR(30),
    erstellt_am TIMESTAMP WITH TIME ZONE,
    aktualisiert_am TIMESTAMP WITH TIME ZONE,
    erstellt_von_spieler_id UUID REFERENCES spieler(id)
);

CREATE TABLE tisch_spieler (
    tisch_id UUID NOT NULL REFERENCES tisch(id) ON DELETE CASCADE,
    spieler_id UUID NOT NULL REFERENCES spieler(id),
    tisch_spieler_key VARCHAR(10) NOT NULL,
    PRIMARY KEY (tisch_id, spieler_id)
);

CREATE TABLE spiel (
    id UUID PRIMARY KEY,
    partie_id UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
    spiel_nummer INT NOT NULL,
    geber_position VARCHAR(10) NOT NULL,
    spieltyp VARCHAR(30) NOT NULL,
    phase VARCHAR(30) NOT NULL,
    vorbehalte TEXT,
    ansagen TEXT,
    armut_spieler_position VARCHAR(10),
    armut_aktueller_antwort_index INT NOT NULL DEFAULT 0,
    armut_angebot_abgegeben BOOLEAN NOT NULL DEFAULT FALSE,
    armut_partner_spieler_position VARCHAR(10),
    armut_angebotene_karten TEXT,
    hochzeit_spieler_position VARCHAR(10),
    hochzeit_geklaerte_stiche INT NOT NULL DEFAULT 0,
    hochzeit_partner_spieler_position VARCHAR(10),
    hochzeit_stilles_solo BOOLEAN NOT NULL DEFAULT FALSE,
    pflicht_ansage_ausstehend TEXT NOT NULL DEFAULT '[]',
    schweinchen_aktiv BOOLEAN NOT NULL DEFAULT FALSE,
    bereits_geschmissen_json VARCHAR(100) NOT NULL DEFAULT '[]',
    einwurf_zaehler INT NOT NULL DEFAULT 0,
    aktueller_stich_aufspieler_position VARCHAR(10),
    aktueller_stich_karten TEXT,
    re_augen INT,
    kontra_augen INT,
    sieger_partei VARCHAR(10),
    spielwert INT,
    grundwert INT,
    absage_punkte INT,
    gegen_die_alten_punkte INT,
    solo_multiplikator INT,
    spielpunkte_sued INT,
    spielpunkte_west INT,
    spielpunkte_nord INT,
    spielpunkte_ost INT,
    haende_json TEXT NOT NULL DEFAULT '[]',
    stiche_json TEXT NOT NULL DEFAULT '[]',
    sonderpunkte_json TEXT NOT NULL DEFAULT '[]',
    erstellt_am TIMESTAMP WITH TIME ZONE,
    aktualisiert_am TIMESTAMP WITH TIME ZONE
);

CREATE TABLE spielergebnis_archiv (
    id UUID PRIMARY KEY,
    partie_id UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
    spiel_nummer INT NOT NULL,
    geber_position VARCHAR(10),
    spieltyp VARCHAR(30),
    ist_solo BOOLEAN NOT NULL DEFAULT FALSE,
    solo_typ VARCHAR(30),
    re_augen INT,
    kontra_augen INT,
    sieger_partei VARCHAR(10),
    spielwert INT,
    grundwert INT,
    absage_punkte INT,
    gegen_die_alten_punkte INT,
    solo_multiplikator INT,
    spielpunkte_sued INT,
    spielpunkte_west INT,
    spielpunkte_nord INT,
    spielpunkte_ost INT,
    abgeschlossen_am TIMESTAMP WITH TIME ZONE,
    UNIQUE(partie_id, spiel_nummer)
);

CREATE TABLE sonderpunkt_eintrag (
    id UUID PRIMARY KEY,
    spielergebnis_archiv_id UUID NOT NULL REFERENCES spielergebnis_archiv(id) ON DELETE CASCADE,
    partei VARCHAR(10),
    sonderpunkt_typ VARCHAR(50),
    taeter_position VARCHAR(10),
    opfer_position VARCHAR(10)
);

CREATE TABLE partie_teilnehmer (
    id UUID PRIMARY KEY,
    partie_id UUID NOT NULL REFERENCES partie(id) ON DELETE CASCADE,
    spieler_id UUID NOT NULL REFERENCES spieler(id),
    spieler_position VARCHAR(10) NOT NULL,
    beigetreten_am TIMESTAMP WITH TIME ZONE,
    ausgeschieden_am TIMESTAMP WITH TIME ZONE,
    UNIQUE(partie_id, spieler_position)
);

CREATE TABLE spieler_statistik (
    id UUID PRIMARY KEY,
    spieler_id UUID NOT NULL REFERENCES spieler(id),
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
    erstellt_am TIMESTAMP WITH TIME ZONE,
    aktualisiert_am TIMESTAMP WITH TIME ZONE,
    UNIQUE(spieler_id, regelvariante)
);

CREATE TABLE event_publication (
    id UUID NOT NULL,
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

CREATE TABLE partie_ergebnis (
    id UUID PRIMARY KEY,
    spieler_id UUID NOT NULL REFERENCES spieler(id),
    tisch_name VARCHAR(100),
    datum TIMESTAMP WITH TIME ZONE,
    end_punktestand INT,
    rangplatz INT,
    spielanzahl INT,
    erstellt_am TIMESTAMP WITH TIME ZONE,
    aktualisiert_am TIMESTAMP WITH TIME ZONE
);
