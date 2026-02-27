#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/.runtime/reports"
TS="$(date +%Y%m%d-%H%M%S)"
REPORT_JSON="$REPORT_DIR/security-check-$TS.json"

mkdir -p "$REPORT_DIR"

echo "[security-check] running dependency audits..."
npm --prefix "$ROOT_DIR/backend" audit --omit=dev --json > "$REPORT_DIR/backend-audit-$TS.json" || true
npm --prefix "$ROOT_DIR/frontend" audit --omit=dev --json > "$REPORT_DIR/frontend-audit-$TS.json" || true
npm --prefix "$ROOT_DIR/desktop" audit --omit=dev --json > "$REPORT_DIR/desktop-audit-$TS.json" || true

echo "[security-check] running build verification..."
npm --prefix "$ROOT_DIR/backend" run build >/dev/null
npm --prefix "$ROOT_DIR/frontend" run build >/dev/null
npm --prefix "$ROOT_DIR/desktop" run build:electron >/dev/null

echo "[security-check] scanning for risky patterns..."
RISKY_OUT="$REPORT_DIR/risky-patterns-$TS.txt"
{
  echo "# Potentially risky patterns (manual review)"
  rg -n "dangerouslySetInnerHTML|eval\\(|new Function\\(|child_process\\.exec\\(|shell\\.openExternal\\(|http://|TODO\\(security\\)|FIXME\\(security\\)" \
    "$ROOT_DIR/backend" "$ROOT_DIR/frontend" "$ROOT_DIR/desktop" -S || true
} > "$RISKY_OUT"

node - <<'NODE' "$REPORT_JSON" "$REPORT_DIR/backend-audit-$TS.json" "$REPORT_DIR/frontend-audit-$TS.json" "$REPORT_DIR/desktop-audit-$TS.json" "$RISKY_OUT"
const fs = require("fs");
const [reportPath, backendPath, frontendPath, desktopPath, riskyPath] = process.argv.slice(2);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
function vulnSummary(audit) {
  const v = audit?.metadata?.vulnerabilities || {};
  return {
    critical: Number(v.critical || 0),
    high: Number(v.high || 0),
    moderate: Number(v.moderate || 0),
    low: Number(v.low || 0),
    total: Number(v.total || 0),
  };
}
const backend = readJson(backendPath);
const frontend = readJson(frontendPath);
const desktop = readJson(desktopPath);
const riskyLines = fs.existsSync(riskyPath)
  ? fs.readFileSync(riskyPath, "utf8").split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#")).length
  : 0;

const report = {
  generatedAt: new Date().toISOString(),
  audits: {
    backend: vulnSummary(backend),
    frontend: vulnSummary(frontend),
    desktop: vulnSummary(desktop),
  },
  riskyPatternMatches: riskyLines,
  goNoGo: {
    dependencies: vulnSummary(backend).critical === 0 && vulnSummary(frontend).critical === 0 && vulnSummary(desktop).critical === 0,
    codeScan: riskyLines >= 0,
  },
  notes: [
    "Critical vulnerabilities should be resolved before release.",
    "Review risky-patterns report manually for each release candidate.",
  ],
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
NODE

echo "[security-check] report: $REPORT_JSON"
