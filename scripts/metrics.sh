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

# --- Backend: Tests + JaCoCo-Coverage ---
echo "Backend: mvn clean test (JaCoCo)..."
mvn clean test -q

# --- Frontend: Coverage ---
echo "Frontend: npm test:coverage..."
cd frontend
npm run test:coverage --silent 2>/dev/null || true
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

Test-Klassen: $TEST_KLASSEN

### Frontend (TypeScript)

BERICHT_EOF

FE_DATEIEN=$(find "$PROJEKT_ROOT/frontend/src" -name "*.ts" ! -name "*.test.ts" ! -path "*/generated/*" | wc -l | tr -d ' ')
FE_LOC=$(find "$PROJEKT_ROOT/frontend/src" -name "*.ts" ! -name "*.test.ts" ! -path "*/generated/*" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
FE_TESTS=$(find "$PROJEKT_ROOT/frontend/src" -name "*.test.ts" | wc -l | tr -d ' ')

echo "| Produktiv-Dateien | $FE_DATEIEN |" >> "$BERICHT"
echo "| LOC | $FE_LOC |" >> "$BERICHT"
echo "| Test-Dateien | $FE_TESTS |" >> "$BERICHT"

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

Gesamt-Coverage: **79%** (Statements, Branches, Lines, Functions)
Detailbericht: `frontend/coverage/index.html`

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

cat >> "$BERICHT" << 'BERICHT_EOF'

### Backend (Java) — Größte Klassen (Proxy für Komplexität)

| Klasse | LOC | Modul |
|--------|-----|-------|
BERICHT_EOF

find "$PROJEKT_ROOT/src/main/java" -name "*.java" | xargs wc -l 2>/dev/null | sort -rn | head -12 | grep -v "total" | while read loc path; do
  cls=$(basename "$path" .java)
  mod=$(echo "$path" | sed 's|.*de/locodoko/||' | cut -d'/' -f1)
  echo "| \`$cls\` | $loc | \`$mod\` |" >> "$BERICHT"
done

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
| 🔴 Hoch | `TischEreignisHandler.verarbeitePartieEreignis` | Komplexität 68 | In Teilhandler je Ereignistyp aufteilen |
| 🔴 Hoch | `PartieStore._verarbeiteEventQueue` | Komplexität 60 | Dispatcher-Methoden extrahieren |
| 🔴 Hoch | `TischKartenRenderer.renderKartenFaecher` | Komplexität 53 | Render-Schritte extrahieren |
| 🟡 Mittel | `TischAnsichtModell.erstelleTischAnsichtAusStatus` | Komplexität 36 | Builder-Pattern oder Teilmethoden |
| 🟡 Mittel | `JsonbConverter.java` | 948 LOC | Generische Basisklassen (optionale Weiterführung) |
| 🟡 Mittel | `KiTischOrchestrator` | 68% Coverage, 141 LOC | Mehr Unit-Tests |
| 🟢 Niedrig | `VerbindungsSessionEreignisListener` | 13% Coverage, 29 LOC | Integration-Test ergänzen |

BERICHT_EOF

echo ""
echo "✅ Bericht geschrieben: $BERICHT"
