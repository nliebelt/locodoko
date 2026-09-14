#!/usr/bin/env python3
"""
Spec-Lint für Locodoko: prüft tote Referenzen in specs/*.md gegen Quellcode.

Geprüft wird:
  (a) CamelCase-Klassennamen mit bekanntem Code-Suffix (Service, Handler, Renderer etc.)
  (b) SCREAMING_SNAKE_CASE mit Unterstrich → Java-Enum-Konstanten
  (c) Methoden-Referenzen (Klasse.methode()) → Klasse muss existieren
  (d) Dateipfade (src/, frontend/, e2e/ etc.) → Pfad muss existieren

Übersprungen: review-*.md, Zeilen mit ~~, @Annotationen, whitelisted Namen.

Aufruf:  python3 check_specs.py [--verbose]
Exit:    0 = sauber, 1 = tote Referenzen gefunden
"""

import glob
import os
import re
import sys

VERBOSE = "--verbose" in sys.argv or "-v" in sys.argv

# ─── Konfiguration ────────────────────────────────────────────────────────────

# Historische Dokumente komplett überspringen
SKIP_FILENAMES = frozenset({
    "review-2026-05-28.md",
    "review-2026-07-02.md",
})

# Bekannte Code-Suffixe: nur CamelCase-Bezeichner die darauf enden werden geprüft.
# Suffix = letztes Wort im CamelCase-Namen (nach dem letzten Großbuchstaben).
# Listet ausschließlich Suffixe die in diesem Projekt als Typ-Konvention gelten.
CODE_SUFFIXES = (
    # Java — Schicht-Klassen
    "Service", "Controller", "Repository", "Handler", "Orchestrator",
    "Renderer", "Manager", "Rechner", "Mapper", "Listener", "Filter",
    "Interceptor", "Validator", "Builder", "Factory", "Scheduler",
    # Java — Daten / Ausnahmen
    "Antwort", "Anfrage", "Dto", "Embeddable", "Eintrag",
    "Exception", "Test",
    # TypeScript — Schicht-Klassen
    "Szene", "Modal", "Dialog", "Overlay", "Api", "Kontroller",
    # Modell
    "Modell",
    # Store (Java + TS)
    "Store",
)

# Klassen/Typen die nicht im Projekt-Code liegen (externe Libs) aber einen Code-Suffix haben
WHITELIST_CLASSES = frozenset({
    # Spring Security
    "UserDetailsService",
    "OncePerRequestFilter",
    "SecurityContextHolder",
    "PasswordEncoder",
    # Spring Data / Persistence
    "OptimisticLockingFailureException",
    "DataIntegrityViolationException",
    # Spring Modulith
    "ApplicationModules",
    # Java stdlib
    "ScheduledExecutorService",
    # Protokoll-Bezeichner im WS-Spec (kein direktes Java-Äquivalent)
    "ArmutAntwort",
})

# Enum-Konstanten die nicht im Projekt-Code liegen (Spring-intern, Konfiguration, env-Vars)
WHITELIST_ENUMS = frozenset({
    # Spring TransactionPhase
    "AFTER_COMMIT", "AFTER_ROLLBACK", "AFTER_COMPLETION", "BEFORE_COMMIT",
    # Spring Propagation
    "REQUIRES_NEW", "REQUIRED", "SUPPORTS", "NOT_SUPPORTED", "MANDATORY",
    # Spring Isolation
    "READ_COMMITTED", "READ_UNCOMMITTED", "SERIALIZABLE", "REPEATABLE_READ",
    # Spring Security — Rollen-Strings
    "ROLE_SPIELER", "ROLE_ADMIN",
    # OAuth2 / Google-Konfiguration
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    # Mail-Konfiguration
    "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD",
    # Monitoring
    "GRAFANA_CLOUD_TOKEN",
    # Frontend Build-Umgebungsvariable
    "VITE_SENTRY_DSN",
    # Aspirational WS-Event-Bezeichner (noch nicht in PartieEreignisTyp)
    "NEUE_PARTIE_GESTARTET",
    # Zeichenkodierung
    "UTF_8", "ISO_8859_1",
    # Betrieb-Deployment: Umgebungsvariablen-Namen in Tabellen (keine Java-Enum-Konstanten)
    "SPRING_PROFILES_ACTIVE", "LOCODOKO_DB_USERNAME", "LOCODOKO_DB_PASSWORD",
    "LOCODOKO_DB_URL", "LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS", "SENTRY_DSN",
    "LOCODOKO_BUGREPORT_GITHUB_TOKEN",
})

# Pfad-Präfixe die gegen das Dateisystem geprüft werden
# .github/ absichtlich ausgelassen — CI-Config-Pfade sind keine Spec-Referenzen
CHECKABLE_PATH_PREFIXES = (
    "src/", "frontend/", "e2e/", "scripts/", "specs/", "docs/",
)

# Regex-Muster
RE_BACKTICK = re.compile(r'`([^`\n]+)`')
RE_SCREAMING = re.compile(r'^[A-Z][A-Z0-9]*_[A-Z0-9_]+$')  # UPPER_CASE mit Unterstrich
RE_METHOD_REF = re.compile(r'^([A-Z][A-Za-z0-9]{4,})\.([a-z][A-Za-z0-9]*)\(\)$')
RE_LINE_SUFFIX = re.compile(r':\d+.*$')  # ":123" oder ":82–89" am Pfadende


# ─── Index-Aufbau ────────────────────────────────────────────────────────────

def build_java_index() -> tuple[set[str], set[str]]:
    """Alle Java-Klassen und Enum-Konstanten aus main + test."""
    classes: set[str] = set()
    enum_constants: set[str] = set()

    type_pat = re.compile(r'\b(?:class|interface|record|enum)\s+([A-Z]\w+)')
    enum_block_pat = re.compile(r'\benum\s+\w+[^{]*\{([^}]+?)\}', re.DOTALL)
    const_pat = re.compile(r'\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b')

    java_paths = glob.glob("src/main/java/**/*.java", recursive=True)
    java_paths += glob.glob("src/test/java/**/*.java", recursive=True)

    for path in java_paths:
        try:
            content = open(path, encoding="utf-8").read()
        except OSError:
            continue
        for m in type_pat.finditer(content):
            classes.add(m.group(1))
        for block_m in enum_block_pat.finditer(content):
            for m in const_pat.finditer(block_m.group(1)):
                enum_constants.add(m.group(1))

    return classes, enum_constants


def build_ts_index() -> set[str]:
    """Alle TypeScript-Typen: Klassen/Interfaces/Enums aus Definitionen + Dateinamen."""
    names: set[str] = set()

    # (1) class / interface / type / enum Definitionen
    pat = re.compile(r'\b(?:class|interface|type|enum)\s+([A-Z]\w+)')
    for path in glob.glob("frontend/src/**/*.ts", recursive=True):
        try:
            content = open(path, encoding="utf-8").read()
        except OSError:
            continue
        for m in pat.finditer(content):
            names.add(m.group(1))

    # (2) Dateinamen als gültige Modul-Bezeichner
    # TischHudRenderer.ts → TischHudRenderer; TischHudRenderer.test.ts → überspringen
    for path in glob.glob("frontend/src/**/*.ts", recursive=True):
        basename = os.path.basename(path)
        if basename.endswith(".test.ts") or basename.endswith(".d.ts"):
            continue
        module_name = basename[:-3]  # .ts entfernen
        if module_name and module_name[0].isupper():
            names.add(module_name)

    return names


# ─── Referenz-Prüfung ────────────────────────────────────────────────────────

def ends_with_code_suffix(ref: str) -> bool:
    """True wenn ref auf einen bekannten Code-Suffix endet."""
    return any(ref.endswith(s) for s in CODE_SUFFIXES)


def check_path_ref(ref: str) -> bool:
    """True wenn der Pfad existiert (Zeilennummern-/Bereichsanhang wird entfernt)."""
    clean = RE_LINE_SUFFIX.sub("", ref).rstrip("/")
    return os.path.exists(clean)


def process_line(
    line: str,
    java_classes: set[str],
    java_enums: set[str],
    ts_classes: set[str],
) -> list[tuple[str, str]]:
    """Gibt Liste von (kind, ref) zurück für tote Referenzen in dieser Zeile."""
    findings: list[tuple[str, str]] = []

    # Zeilen mit Strikethrough (~~) überspringen
    if "~~" in line:
        return findings
    # HTML-Kommentare überspringen
    if line.strip().startswith("<!--"):
        return findings

    all_known = java_classes | ts_classes

    for m in RE_BACKTICK.finditer(line):
        ref = m.group(1).strip()
        if not ref:
            continue

        # @Annotationen überspringen
        if ref.startswith("@"):
            continue

        # Refs mit Winkelklammern (Generics), Leerzeichen, {}, [] → keine Bezeichner
        if any(c in ref for c in " \t<>{}[]"):
            continue

        # (d) Dateipfad: beginnt mit bekanntem Prefix und enthält "/"
        if "/" in ref and any(ref.startswith(p) for p in CHECKABLE_PATH_PREFIXES):
            if not check_path_ref(ref):
                findings.append(("Pfad", ref))
            continue

        # Sonstige Refs mit "/" → WS-Destinations, URLs, Paketnamen → überspringen
        if "/" in ref:
            continue

        # (c) Methoden-Referenz: Klasse.methode()
        mm = RE_METHOD_REF.match(ref)
        if mm:
            class_name = mm.group(1)
            if class_name not in WHITELIST_CLASSES and class_name not in all_known:
                findings.append(("MethodenKlasse", ref))
            continue

        # Refs mit Punkt (aber kein Method-Ref) → Paket.Klasse, Dateiname.ext → überspringen
        if "." in ref:
            continue

        # (b) SCREAMING_SNAKE_CASE mit Unterstrich → Enum-Konstante
        if RE_SCREAMING.match(ref):
            if ref not in WHITELIST_ENUMS and ref not in java_enums:
                findings.append(("EnumKonstante", ref))
            continue

        # (a) CamelCase-Klassenname: nur wenn auf bekanntem Code-Suffix endet
        if ref[0].isupper() and ends_with_code_suffix(ref):
            if ref not in WHITELIST_CLASSES and ref not in all_known:
                findings.append(("Klasse", ref))

    return findings


# ─── Hauptprogramm ───────────────────────────────────────────────────────────

def main() -> None:
    if VERBOSE:
        print("Spec-Lint: Starte Index-Aufbau …")

    java_classes, java_enums = build_java_index()
    ts_classes = build_ts_index()

    if VERBOSE:
        print(f"  Java-Klassen: {len(java_classes)}")
        print(f"  Java-Enum-Konstanten: {len(java_enums)}")
        print(f"  TS-Klassen/Module: {len(ts_classes)}")

    all_findings: list[tuple[str, int, str, str]] = []
    spec_files = sorted(glob.glob("specs/*.md"))
    checked = 0

    for spec_path in spec_files:
        fname = os.path.basename(spec_path)
        if fname in SKIP_FILENAMES:
            if VERBOSE:
                print(f"  Übersprungen (historisch): {spec_path}")
            continue

        try:
            content = open(spec_path, encoding="utf-8").read()
        except OSError as e:
            print(f"FEHLER: Kann {spec_path} nicht lesen: {e}", file=sys.stderr)
            continue

        checked += 1
        for lineno, line in enumerate(content.splitlines(), 1):
            for kind, ref in process_line(line, java_classes, java_enums, ts_classes):
                all_findings.append((spec_path, lineno, kind, ref))

    if all_findings:
        print(f"\n❌ Spec-Lint: {len(all_findings)} tote Referenz(en) in {checked} Spec-Dateien:\n")
        for spec_path, lineno, kind, ref in all_findings:
            print(f"  {spec_path}:{lineno}: [{kind}] `{ref}`")
        print(
            "\nHinweis: Legitimierte Fremdbegriffe → WHITELIST_CLASSES / WHITELIST_ENUMS in check_specs.py ergänzen."
        )
        sys.exit(1)
    else:
        print(f"✓ Spec-Lint: 0 tote Referenzen in {checked} Spec-Dateien geprüft.")
        sys.exit(0)


if __name__ == "__main__":
    main()
