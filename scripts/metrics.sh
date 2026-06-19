#!/usr/bin/env bash
# Metrik-Report für Locodoko erzeugen.
# Ausgabe: docs/metrics.md
# Voraussetzung: aus Projektroot aufrufen (mvn + npm müssen im PATH sein)
set -euo pipefail

PROJEKT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BERICHT="$PROJEKT_ROOT/docs/metrics.md"
DATUM=$(date '+%Y-%m-%d')

cd "$PROJEKT_ROOT"

echo "=== Locodoko Metrik-Report wird erzeugt ==="

# lizard Verfügbarkeit sicherstellen (kein System-Install voraussetzen)
if ! python3 -m lizard --version > /dev/null 2>&1; then
    echo "Installiere lizard via pip..."
    python3 -m pip install --user lizard --quiet || true
fi

# --- Backend: Tests + JaCoCo-Coverage ---
echo "Backend: mvn clean test (JaCoCo)..."
mvn clean test -q

BE_TESTS=$(python3 -c "
import os, xml.etree.ElementTree as ET
total = 0
d = 'target/surefire-reports'
if os.path.isdir(d):
    for f in os.listdir(d):
        if f.endswith('.xml'):
            try:
                total += int(ET.parse(os.path.join(d, f)).getroot().get('tests', 0))
            except: pass
print(total)
" 2>/dev/null || echo "?")

# --- Frontend: Coverage + Testzahl ---
echo "Frontend: npm test:coverage..."
cd frontend
FE_TEST_OUTPUT=$(npm run test:coverage 2>&1 || true)
FE_TESTS_COUNT=$(echo "$FE_TEST_OUTPUT" | grep -E '^\s+Tests\s+[0-9]+ passed' | awk '{print $2}' | head -1)
[ -z "$FE_TESTS_COUNT" ] && FE_TESTS_COUNT="?"
cd "$PROJEKT_ROOT"

# --- Bericht schreiben ---
cat > "$BERICHT" << BERICHT_EOF
# Locodoko — Metrik-Report

> Stand: $DATUM — reproduzierbar via \`scripts/metrics.sh\`

## Codebase-Größe

### Backend (Java)

| Modul | Dateien | LOC |
|-------|---------|-----|
BERICHT_EOF

for mod in karten partie spieler ki tisch system; do
  count=$(find "$PROJEKT_ROOT/src/main/java/de/locodoko/$mod" -name "*.java" 2>/dev/null | wc -l | tr -d ' ')
  loc=$(find "$PROJEKT_ROOT/src/main/java/de/locodoko/$mod" -name "*.java" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
  echo "| \`$mod\` | $count | $loc |" >> "$BERICHT"
done

TOTAL_JAVA=$(find "$PROJEKT_ROOT/src/main/java" -name "*.java" | wc -l | tr -d ' ')
TOTAL_LOC=$(find "$PROJEKT_ROOT/src/main/java" -name "*.java" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
TEST_KLASSEN=$(find "$PROJEKT_ROOT/src/test" -name "*.java" | wc -l | tr -d ' ')

cat >> "$BERICHT" << BERICHT_EOF
| **Gesamt** | **$TOTAL_JAVA** | **$TOTAL_LOC** |

Test-Klassen: $TEST_KLASSEN | Tests: **$BE_TESTS**

### Frontend (TypeScript)

BERICHT_EOF

FE_DATEIEN=$(find "$PROJEKT_ROOT/frontend/src" -name "*.ts" ! -name "*.test.ts" ! -path "*/generated/*" | wc -l | tr -d ' ')
FE_LOC=$(find "$PROJEKT_ROOT/frontend/src" -name "*.ts" ! -name "*.test.ts" ! -path "*/generated/*" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
FE_TESTS=$(find "$PROJEKT_ROOT/frontend/src" -name "*.test.ts" | wc -l | tr -d ' ')

echo "| Produktiv-Dateien | $FE_DATEIEN |" >> "$BERICHT"
echo "| LOC | $FE_LOC |" >> "$BERICHT"
echo "| Test-Dateien | $FE_TESTS |" >> "$BERICHT"
echo "| Tests | **$FE_TESTS_COUNT** |" >> "$BERICHT"

cat >> "$BERICHT" << 'BERICHT_EOF'

## Test-Coverage

### Backend (JaCoCo)

BERICHT_EOF

if [ -f "$PROJEKT_ROOT/target/site/jacoco/jacoco.csv" ]; then
  python3 - << 'PYEOF' >> "$BERICHT"
import csv

with open('target/site/jacoco/jacoco.csv') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Gesamtsumme
totals = {k: 0 for k in ['INSTRUCTION_COVERED','INSTRUCTION_MISSED','LINE_COVERED','LINE_MISSED','BRANCH_COVERED','BRANCH_MISSED']}
for row in rows:
    for k in totals:
        totals[k] += int(row[k])

inst_total = totals['INSTRUCTION_COVERED'] + totals['INSTRUCTION_MISSED']
line_total = totals['LINE_COVERED'] + totals['LINE_MISSED']
branch_total = totals['BRANCH_COVERED'] + totals['BRANCH_MISSED']

print(f"| Metrik | Abgedeckt | Gesamt | Quote |")
print(f"|--------|-----------|--------|-------|")
print(f"| Instructions | {totals['INSTRUCTION_COVERED']} | {inst_total} | **{100*totals['INSTRUCTION_COVERED']//inst_total}%** |")
print(f"| Lines | {totals['LINE_COVERED']} | {line_total} | **{100*totals['LINE_COVERED']//line_total}%** |")
print(f"| Branches | {totals['BRANCH_COVERED']} | {branch_total} | **{100*totals['BRANCH_COVERED']//branch_total}%** |")

# Pro Modul
pkgs = {}
for row in rows:
    pkg = row['PACKAGE'].replace('de/locodoko/','').split('/')[0]
    if pkg == 'de.locodoko':
        pkg = '(root)'
    if pkg not in pkgs:
        pkgs[pkg] = {'lc': 0, 'lm': 0}
    pkgs[pkg]['lc'] += int(row['LINE_COVERED'])
    pkgs[pkg]['lm'] += int(row['LINE_MISSED'])

print()
print("**Coverage nach Modul:**")
print()
print("| Modul | Lines | Coverage |")
print("|-------|-------|----------|")
for pkg, d in sorted(pkgs.items()):
    total = d['lc'] + d['lm']
    pct = 100*d['lc']//total if total else 0
    bar = '█' * (pct // 10) + '░' * (10 - pct // 10)
    print(f"| `{pkg}` | {total} | {pct}% {bar} |")

# Schwachstellen
print()
print("**Coverage-Schwachstellen (< 70% Line-Coverage, > 20 Zeilen):**")
print()
print("| Klasse | Modul | Lines | Coverage |")
print("|--------|-------|-------|----------|")
weak = []
for row in rows:
    total = int(row['LINE_COVERED']) + int(row['LINE_MISSED'])
    if total <= 20:
        continue
    pct = 100*int(row['LINE_COVERED'])//total
    if pct < 70:
        pkg = row['PACKAGE'].replace('de/locodoko/','').replace('/', '.')
        weak.append((pct, row['CLASS'], total, pkg))
weak.sort()
for pct, cls, loc, pkg in weak:
    print(f"| `{cls}` | `{pkg}` | {loc} | {pct}% |")
PYEOF
fi

cat >> "$BERICHT" << 'BERICHT_EOF'

### Frontend (Vitest/V8)

BERICHT_EOF

COV_FILE="$PROJEKT_ROOT/frontend/coverage/coverage-final.json"
if [ -f "$COV_FILE" ]; then
  python3 - "$COV_FILE" >> "$BERICHT" << 'PYEOF'
import json, sys

with open(sys.argv[1]) as f:
    data = json.load(f)

s_total=s_cov=b_total=b_cov=fn_total=fn_cov=0
for fd in data.values():
    for v in fd['s'].values():
        s_total += 1
        if v: s_cov += 1
    for v in fd['b'].values():
        for bv in v:
            b_total += 1
            if bv: b_cov += 1
    for v in fd['f'].values():
        fn_total += 1
        if v: fn_cov += 1

s_pct = 100*s_cov//s_total if s_total else 0
b_pct = 100*b_cov//b_total if b_total else 0
fn_pct = 100*fn_cov//fn_total if fn_total else 0

print(f"| Metrik | Abgedeckt | Gesamt | Quote |")
print(f"|--------|-----------|--------|-------|")
print(f"| Statements | {s_cov} | {s_total} | **{s_pct}%** |")
print(f"| Branches | {b_cov} | {b_total} | **{b_pct}%** |")
print(f"| Functions | {fn_cov} | {fn_total} | **{fn_pct}%** |")
print()
print("Detailbericht: `frontend/coverage/index.html`")
PYEOF
else
  echo "Kein Coverage-Report vorhanden — \`npm run test:coverage\` ausführen." >> "$BERICHT"
fi

cat >> "$BERICHT" << 'BERICHT_EOF'

## Komplexitäts-Hotspots

### Frontend (ESLint Cyclomatic Complexity > 10)

| Datei | Methode | Komplexität |
|-------|---------|-------------|
BERICHT_EOF

cd "$PROJEKT_ROOT/frontend"
ESLINT_TMP=$(mktemp /tmp/eslint-XXXX.json)
npx eslint src --rule '{"complexity": ["warn", 10]}' --format json > "$ESLINT_TMP" 2>/dev/null || true
python3 - "$ESLINT_TMP" >> "$BERICHT" << 'PYEOF'
import sys, json, re
with open(sys.argv[1]) as fh:
    data = json.load(fh)
findings = []
for f in data:
    for m in f.get('messages', []):
        if 'complexity' in m.get('ruleId', ''):
            match = re.search(r'complexity of (\d+)', m.get('message',''))
            if match:
                complexity = int(match.group(1))
                name = re.search(r"'([^']+)'", m.get('message',''))
                fpath = f['filePath']
                fname = fpath.split('frontend/src/')[-1] if 'frontend/src/' in fpath else fpath.split('src/')[-1]
                findings.append((complexity, fname, name.group(1) if name else '?', m['line']))
findings.sort(reverse=True)
for complexity, fname, method, line in findings[:20]:
    print(f"| `{fname}:{line}` | `{method}` | **{complexity}** |")
PYEOF
rm -f "$ESLINT_TMP"
cd "$PROJEKT_ROOT"

cat >> "$BERICHT" << 'BERICHT_EOF'

### Backend (Java) — Komplexitäts-Hotspots (lizard CCN, Top 20)

| Funktion | Modul | CCN | NLOC |
|----------|-------|-----|------|
BERICHT_EOF

if python3 -m lizard --version > /dev/null 2>&1; then
  LIZARD_TMP=$(mktemp /tmp/lizard-XXXX.csv)
  python3 -m lizard "$PROJEKT_ROOT/src/main/java" -l java --csv > "$LIZARD_TMP" 2>/dev/null || true
  python3 - "$LIZARD_TMP" "$PROJEKT_ROOT/src/main/java" >> "$BERICHT" << 'PYEOF'
import csv, sys

with open(sys.argv[1]) as f:
    rows = list(csv.reader(f))

src_root = sys.argv[2]
entries = []
for r in rows:
    if len(r) < 8: continue
    try:
        ccn = int(r[1])
        nloc = int(r[0])
        func = r[7]
        filepath = r[6]
        parts = filepath.split('/de/locodoko/')
        mod = parts[1].split('/')[0] if len(parts) > 1 else '?'
    except (ValueError, IndexError):
        continue
    entries.append((ccn, nloc, func, mod))

entries.sort(reverse=True)
for ccn, nloc, func, mod in entries[:20]:
    print(f"| `{func}` | `{mod}` | **{ccn}** | {nloc} |")
PYEOF
  rm -f "$LIZARD_TMP"
else
  echo "*(lizard nicht verfügbar — `python3 -m pip install lizard` ausführen)*" >> "$BERICHT"
fi

# scc COCOMO (optional — nur wenn vorhanden)
if command -v scc > /dev/null 2>&1; then
  cat >> "$BERICHT" << 'BERICHT_EOF'

## COCOMO-Kostenschätzung (scc)

BERICHT_EOF
  scc "$PROJEKT_ROOT/src/main/java" "$PROJEKT_ROOT/frontend/src" --format markdown >> "$BERICHT" 2>/dev/null || true
fi

cat >> "$BERICHT" << 'BERICHT_EOF'

## Architektur-Check (Modul-Grenzen)

Erlaubte Abhängigkeitsrichtung: `tisch → partie, spieler, ki` · `ki → partie, karten` · `partie → karten` · `spieler → partie.ereignisse`

BERICHT_EOF

check_import() {
  local FROM=$1 TO=$2 LABEL=$3
  local count=$(grep -r "import.*de.locodoko.$TO" "$PROJEKT_ROOT/src/main/java/de/locodoko/$FROM/" 2>/dev/null | grep -v "de.locodoko.$TO.ereignisse" | wc -l)
  if [ "$count" -gt 0 ]; then
    echo "| $LABEL | ⚠️ VERLETZUNG ($count Imports) |" >> "$BERICHT"
  else
    echo "| $LABEL | ✅ OK |" >> "$BERICHT"
  fi
}

echo "| Prüfung | Ergebnis |" >> "$BERICHT"
echo "|---------|----------|" >> "$BERICHT"
check_import "partie" "tisch" "\`partie\` → \`tisch\` (verboten)"
check_import "ki" "spieler" "\`ki\` → \`spieler\` (verboten)"
check_import "karten" "partie" "\`karten\` → \`partie\` (verboten)"

cat >> "$BERICHT" << 'BERICHT_EOF'

## Top-Refactoring-Kandidaten

Abgeleitet aus den obigen Metriken (Details: IMPLEMENTATION_PLAN.md, Sektion Entdeckungen).

| Priorität | Kandidat | Metrik | Empfehlung |
|-----------|----------|--------|------------|
| 🟡 Mittel | `TischEreignisHandler.verarbeiteAnsagen` | FE CCN 25 | Dispatcher je Ansage-Typ |
| 🟡 Mittel | `TischEreignisHandler.verarbeiteSpielfluss` | FE CCN 21 | Teilmethoden je Phase |
| 🟡 Mittel | `TischKartenSortierung.istTrumpfFuerSpieltyp` | FE CCN 21 | Lookup-Tabelle statt if-Kette |
| 🟡 Mittel | `TischHudRenderer.renderTopBar` | FE CCN 20 | Render-Blöcke extrahieren |
| 🟡 Mittel | `StandardKiStrategie::waehleFolgeKarte` | BE CCN 16 | Strategie je Spielsituation |
| 🟡 Mittel | `PartieLifecycleService::veroeffentlicheSpielBeendet` | BE CCN 15, 68 NLOC | Ereignis-Handler extrahieren |
| 🟢 Niedrig | `JsonbConverter.java` | 948 LOC | Generische Basisklassen (optionale Weiterführung) |

BERICHT_EOF

echo ""
echo "✅ Bericht geschrieben: $BERICHT"
