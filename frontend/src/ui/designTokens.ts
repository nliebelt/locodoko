// Zentrale Design-Token-Datei — alle Farben, Schriftgrößen und Animations-Timings
// Farbpalette nach specs/frontend-visuelles-design.md

// =============================================================================
// Spieltisch-Palette (grün) — Tischhintergrund, Kartenrücken, Panels
// =============================================================================
export const TISCH_BG                 = 0x0d1f12;
export const TISCH_BG_CSS             = '#0d1f12';
export const TISCH_SURFACE            = 0x1a3a24;
export const TISCH_SURFACE_CSS        = '#1a3a24';
export const TISCH_BORDER             = 0x2d5a3d;
export const TISCH_BORDER_CSS         = '#2d5a3d';
export const TISCH_BORDER_AKZENT      = 0xf8f9fa;
export const TISCH_BORDER_AKZENT_CSS  = '#f8f9fa';
export const TISCH_TEXT               = 0xf8f9fa;
export const TISCH_TEXT_CSS           = '#f8f9fa';
export const TISCH_TEXT_GEDAEMPFT     = 0xa3c4a8;
export const TISCH_TEXT_GEDAEMPFT_CSS = '#a3c4a8';

// =============================================================================
// Balatro-UI-Palette (purpur) — Overlays, Nameplates, Flash-Text, Modals
// =============================================================================
export const PANEL_BG                 = 0x1a1020;
export const PANEL_BG_CSS             = '#1a1020';
export const CARD_BG                  = 0x221530;
export const CARD_BG_CSS              = '#221530';
export const CARD_BG_DARK             = 0x2d1d40;
export const CARD_BG_DARK_CSS         = '#2d1d40';
export const BORDER_PANEL             = 0x4a2d6a;
export const BORDER_PANEL_CSS         = '#4a2d6a';
export const TEXT_HELL                = 0xf0e6ff;
export const TEXT_HELL_CSS            = '#f0e6ff';
export const TEXT_GEDAEMPFT           = 0x7a5a9a;
export const TEXT_GEDAEMPFT_CSS       = '#7a5a9a';

// =============================================================================
// Akzentfarben (Balatro-UI) — für Flash-Text, Badges, Icons
// =============================================================================
export const FARBE_GOLD               = 0xffd700;
export const FARBE_GOLD_CSS           = '#ffd700';
export const FARBE_GOLD_WARM          = 0xffd166;  // Re-Banner, aktiver Spieler (Spieltisch-Palette)
export const FARBE_GOLD_WARM_CSS      = '#ffd166';
export const FARBE_ROT                = 0xff4455;
export const FARBE_ROT_CSS            = '#ff4455';
export const FARBE_BLAU               = 0x44aaff;
export const FARBE_BLAU_CSS           = '#44aaff';
export const FARBE_GRUEN              = 0x44ff88;
export const FARBE_GRUEN_CSS          = '#44ff88';
export const FARBE_CYAN               = 0x33ffee;
export const FARBE_CYAN_CSS           = '#33ffee';
export const FARBE_PINK               = 0xff55cc;
export const FARBE_PINK_CSS           = '#ff55cc';
export const FARBE_ORANGE             = 0xff8833;
export const FARBE_ORANGE_CSS         = '#ff8833';

// =============================================================================
// Teamfarben
// Spieltisch-Palette: Re = Gold-Warm, Kontra = Blau-Weich (für Banner/Highlights)
// Balatro-Overlay:   Re = Gold,       Kontra = Rot       (für Badges/Flash-Text)
// =============================================================================
export const RE_FARBE                 = 0xffd166;  // Spieltisch: Re-Banner, aktiver Re-Spieler
export const RE_FARBE_CSS             = '#ffd166';
export const RE_FARBE_OVERLAY         = 0xffd700;  // Balatro-Overlay: RE-Badge, Flash-Text
export const RE_FARBE_OVERLAY_CSS     = '#ffd700';
export const KONTRA_FARBE             = 0x90caf9;  // Spieltisch: Kontra-Banner
export const KONTRA_FARBE_CSS         = '#90caf9';
export const KONTRA_FARBE_OVERLAY     = 0xff4455;  // Balatro-Overlay: KONTRA-Badge, Flash-Text
export const KONTRA_FARBE_OVERLAY_CSS = '#ff4455';

// =============================================================================
// Event-Farben (Sonderpunkte) — nach specs/frontend-visuelles-design.md
// =============================================================================
export const FUCHS_FARBE              = 0xff8833;  // Fox Orange — Fuchs gefangen
export const FUCHS_FARBE_CSS          = '#ff8833';
export const FUCHS_SCHATTEN_CSS       = '4px 4px 0 #884400, 0 0 20px #ff8833';

export const SCHWEINCHEN_FARBE        = 0xff55cc;  // Pink — Schweinchen (beide Dullen)
export const SCHWEINCHEN_FARBE_CSS    = '#ff55cc';
export const SCHWEINCHEN_SCHATTEN_CSS = '4px 4px 0 #880066, 0 0 20px #ff55cc';

export const KARLCHEN_FARBE           = 0xffd700;  // Gold — letzter Stich mit Kreuz-Bube
export const KARLCHEN_FARBE_CSS       = '#ffd700';

export const DOPPELKOPF_FARBE        = 0xffd700;  // Gold — Stich ≥ 40 Augen (+ Foil-Shimmer)
export const DOPPELKOPF_FARBE_CSS    = '#ffd700';

export const SPIEL_GESTARTET_FARBE   = 0x33ffee;  // Cyan — Spielbeginn, KI-Label
export const SPIEL_GESTARTET_FARBE_CSS = '#33ffee';
export const SPIEL_GESTARTET_SCHATTEN_CSS = '4px 4px 0 #006655, 0 0 20px #33ffee';

// =============================================================================
// Glow-Schatten (Balatro-Neon-Effekte, CSS-only)
// =============================================================================
export const GOLD_SCHATTEN_CSS        = '4px 4px 0 #7a5000, 0 0 20px #ffd700';
export const ROT_SCHATTEN_CSS         = '4px 4px 0 #880022';
export const GRUEN_SCHATTEN_CSS       = '4px 4px 0 #006633, 0 0 20px #44ff88';

// =============================================================================
// Kartenrücken
// =============================================================================
export const KARTENRUECKEN_BG_CSS     = '#123524';
export const KARTENRUECKEN_MUSTER_CSS = '#d8f3dc';

// =============================================================================
// Typography — Schriftart und -größen (Phaser-Einheiten / px)
// =============================================================================
export const FONT_FAMILY              = "'Press Start 2P'";
export const FONT_FAMILY_FALLBACK     = "'Press Start 2P', monospace";
/** Phaser BitmapFont-Schlüssel für Press Start 2P (Gameplay-Rendering). */
export const FONT_BITMAP_KEY          = 'pressStart2P';
export const FONT_XS                  = 8;
export const FONT_SM                  = 10;
export const FONT_MD                  = 14;
export const FONT_LG                  = 20;
export const FONT_XL                  = 28;

// =============================================================================
// Animation-Timings (ms)
// =============================================================================
export const ANIM_BURST               = 200;   // Sonderpunkt-Burst
export const ANIM_BANNER              = 1200;  // Re/Kontra-Banner sichtbar
export const ANIM_SOLO                = 1500;  // Solo-Ankündigung
export const ANIM_STICH_MIN           = 500;   // Stich-Einziehen minimal
export const ANIM_STICH_MAX           = 700;   // Stich-Einziehen maximal
