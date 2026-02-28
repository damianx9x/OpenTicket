#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/.runtime/reports"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
JSON_REPORT="$REPORT_DIR/dependency-deep-check-$TIMESTAMP.json"
MD_REPORT="$REPORT_DIR/dependency-deep-check-$TIMESTAMP.md"

mkdir -p "$REPORT_DIR"

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/openticket-deps.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

packages=("backend" "frontend" "desktop")

run_audit() {
  local pkg="$1"
  local out="$tmp_dir/${pkg}-audit.json"
  (cd "$ROOT_DIR/$pkg" && npm audit --omit=dev --json >"$out" 2>/dev/null) || true
  if [[ ! -s "$out" ]]; then
    echo "{}" >"$out"
  fi
}

run_outdated() {
  local pkg="$1"
  local out="$tmp_dir/${pkg}-outdated.json"
  (cd "$ROOT_DIR/$pkg" && npm outdated --json >"$out" 2>/dev/null) || true
  if [[ ! -s "$out" ]]; then
    echo "{}" >"$out"
  fi
}

run_direct_deps() {
  local pkg="$1"
  local out="$tmp_dir/${pkg}-direct.json"
  node - "$ROOT_DIR/$pkg/package.json" >"$out" <<'NODE'
const fs = require("fs");
const packageJsonPath = process.argv[2];
const raw = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const deps = raw.dependencies || {};
console.log(JSON.stringify({ count: Object.keys(deps).length, dependencies: deps }, null, 2));
NODE
}

for pkg in "${packages[@]}"; do
  run_audit "$pkg"
  run_outdated "$pkg"
  run_direct_deps "$pkg"
done

node - "$tmp_dir" "$JSON_REPORT" "$MD_REPORT" <<'NODE'
const fs = require("fs");
const path = require("path");

const baseDir = process.argv[2];
const jsonReport = process.argv[3];
const mdReport = process.argv[4];

const packages = ["backend", "frontend", "desktop"];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function parseAuditSummary(audit) {
  const meta = audit.metadata && audit.metadata.vulnerabilities ? audit.metadata.vulnerabilities : {};
  return {
    critical: meta.critical || 0,
    high: meta.high || 0,
    moderate: meta.moderate || 0,
    low: meta.low || 0,
    total: meta.total || 0,
  };
}

function parseHighDetails(audit) {
  const vulnerabilities = audit.vulnerabilities || {};
  const details = [];
  for (const [name, info] of Object.entries(vulnerabilities)) {
    const severity = info && info.severity ? info.severity : "unknown";
    if (!["high", "critical"].includes(severity)) continue;
    const viaRaw = Array.isArray(info.via) ? info.via : [info.via].filter(Boolean);
    const via = viaRaw.map((item) => {
      if (typeof item === "string") return item;
      if (!item) return "unknown";
      const id = item.source ? `#${item.source}` : "advisory";
      return `${item.name || "unknown"}:${item.severity || "unknown"}:${id}`;
    });
    details.push({
      package: name,
      severity,
      fixAvailable: info.fixAvailable || false,
      via,
    });
  }
  return details;
}

function semverMajorChanged(current, latest) {
  if (!current || !latest) return false;
  const c = Number(String(current).replace(/^[^0-9]*/, "").split(".")[0]);
  const l = Number(String(latest).replace(/^[^0-9]*/, "").split(".")[0]);
  if (!Number.isFinite(c) || !Number.isFinite(l)) return false;
  return c !== l;
}

function parseOutdatedSummary(outdated) {
  const entries = Object.entries(outdated || {});
  let major = 0;
  let minorPatch = 0;
  const items = [];
  for (const [name, info] of entries) {
    const current = info.current || "";
    const wanted = info.wanted || "";
    const latest = info.latest || "";
    const isMajor = semverMajorChanged(current, latest);
    if (isMajor) major += 1;
    else minorPatch += 1;
    items.push({
      package: name,
      current,
      wanted,
      latest,
      type: info.type || "unknown",
      majorUpdate: isMajor,
    });
  }
  return {
    total: entries.length,
    major,
    minorPatch,
    items,
  };
}

const result = {
  generatedAt: new Date().toISOString(),
  packages: {},
  rollup: {
    vulnerabilities: {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      total: 0,
    },
    outdated: {
      total: 0,
      major: 0,
      minorPatch: 0,
    },
    directDependencies: 0,
  },
};

for (const pkg of packages) {
  const audit = readJson(path.join(baseDir, `${pkg}-audit.json`));
  const outdated = readJson(path.join(baseDir, `${pkg}-outdated.json`));
  const direct = readJson(path.join(baseDir, `${pkg}-direct.json`));

  const auditSummary = parseAuditSummary(audit);
  const highDetails = parseHighDetails(audit);
  const outdatedSummary = parseOutdatedSummary(outdated);
  const directCount = Number(direct.count || 0);

  result.packages[pkg] = {
    auditSummary,
    highDetails,
    outdatedSummary,
    directDependencies: directCount,
  };

  result.rollup.vulnerabilities.critical += auditSummary.critical;
  result.rollup.vulnerabilities.high += auditSummary.high;
  result.rollup.vulnerabilities.moderate += auditSummary.moderate;
  result.rollup.vulnerabilities.low += auditSummary.low;
  result.rollup.vulnerabilities.total += auditSummary.total;
  result.rollup.outdated.total += outdatedSummary.total;
  result.rollup.outdated.major += outdatedSummary.major;
  result.rollup.outdated.minorPatch += outdatedSummary.minorPatch;
  result.rollup.directDependencies += directCount;
}

fs.writeFileSync(jsonReport, JSON.stringify(result, null, 2));

const md = [];
md.push("# OpenTicket Deep Dependency Check");
md.push("");
md.push(`Generated: ${result.generatedAt}`);
md.push("");
md.push("## Rollup");
md.push("");
md.push(`- Direct dependencies: **${result.rollup.directDependencies}**`);
md.push(
  `- Vulnerabilities: critical **${result.rollup.vulnerabilities.critical}**, high **${result.rollup.vulnerabilities.high}**, moderate **${result.rollup.vulnerabilities.moderate}**, low **${result.rollup.vulnerabilities.low}**, total **${result.rollup.vulnerabilities.total}**`,
);
md.push(
  `- Outdated packages: total **${result.rollup.outdated.total}**, major **${result.rollup.outdated.major}**, minor/patch **${result.rollup.outdated.minorPatch}**`,
);
md.push("");

for (const pkg of packages) {
  const data = result.packages[pkg];
  md.push(`## ${pkg}`);
  md.push("");
  md.push(`- Direct dependencies: **${data.directDependencies}**`);
  md.push(
    `- Vulnerabilities: critical **${data.auditSummary.critical}**, high **${data.auditSummary.high}**, moderate **${data.auditSummary.moderate}**, low **${data.auditSummary.low}**, total **${data.auditSummary.total}**`,
  );
  md.push(
    `- Outdated: total **${data.outdatedSummary.total}**, major **${data.outdatedSummary.major}**, minor/patch **${data.outdatedSummary.minorPatch}**`,
  );
  if (data.highDetails.length > 0) {
    md.push("");
    md.push("High/Critical chains:");
    for (const item of data.highDetails) {
      md.push(
        `- \`${item.package}\` (${item.severity}) via ${item.via.join(", ")} | fixAvailable=${JSON.stringify(item.fixAvailable)}`,
      );
    }
  }
  md.push("");
}

md.push("## Recommended Actions");
md.push("");
md.push("- Resolve direct high advisories first when fix does not require major breaking upgrade.");
md.push("- For major upgrades (e.g., framework jumps), isolate to a dedicated branch with smoke and E2E gates.");
md.push("- Keep release policy: no critical vulnerabilities in runtime dependencies.");
md.push("- Re-run this check before each installer build.");
md.push("");

fs.writeFileSync(mdReport, md.join("\n"));
NODE

echo "[dependency-deep-check] json: $JSON_REPORT"
echo "[dependency-deep-check] md:   $MD_REPORT"
