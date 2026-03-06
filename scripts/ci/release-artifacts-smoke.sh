#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE_DIR="${1:-$ROOT_DIR/Moj}"
REPORT_DIR="$ROOT_DIR/.runtime/reports"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_PATH="$REPORT_DIR/release-artifacts-smoke-$STAMP.json"

mkdir -p "$REPORT_DIR"

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "release-artifacts-smoke: release dir not found: $RELEASE_DIR" >&2
  exit 1
fi

required_manifests=("latest-mac.yml" "latest.yml")
for manifest in "${required_manifests[@]}"; do
  if [[ ! -f "$RELEASE_DIR/$manifest" ]]; then
    echo "release-artifacts-smoke: missing manifest $manifest" >&2
    exit 1
  fi
  if [[ -f "$RELEASE_DIR/$manifest.sha256" ]]; then
    expected="$(awk '{print $1}' "$RELEASE_DIR/$manifest.sha256" | head -n1)"
    actual="$(shasum -a 256 "$RELEASE_DIR/$manifest" | awk '{print $1}')"
    [[ "$expected" == "$actual" ]] || {
      echo "release-artifacts-smoke: sha mismatch for $manifest" >&2
      exit 1
    }
  fi
done

referenced_files=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  referenced_files+=("$line")
done < <(
  awk '
    /^path:[[:space:]]*/ { print $2 }
    /^[[:space:]]*-[[:space:]]*url:[[:space:]]*/ { print $3 }
  ' "$RELEASE_DIR/latest-mac.yml" "$RELEASE_DIR/latest.yml" | tr -d '"' | sort -u
)

if [[ "${#referenced_files[@]}" -eq 0 ]]; then
  echo "release-artifacts-smoke: no referenced files in updater manifests" >&2
  exit 1
fi

for rel in "${referenced_files[@]}"; do
  [[ -z "$rel" ]] && continue
  if [[ ! -f "$RELEASE_DIR/$rel" ]]; then
    echo "release-artifacts-smoke: missing referenced file $rel" >&2
    exit 1
  fi
  if [[ -f "$RELEASE_DIR/$rel.sha256" ]]; then
    expected="$(awk '{print $1}' "$RELEASE_DIR/$rel.sha256" | head -n1)"
    actual="$(shasum -a 256 "$RELEASE_DIR/$rel" | awk '{print $1}')"
    [[ "$expected" == "$actual" ]] || {
      echo "release-artifacts-smoke: sha mismatch for $rel" >&2
      exit 1
    }
  fi
done

have_pkg="false"
have_dmg="false"
have_exe="false"
[[ -f "$RELEASE_DIR/OpenTicket-Installer.pkg" ]] && have_pkg="true"
[[ -f "$RELEASE_DIR/OpenTicket-Installer.dmg" ]] && have_dmg="true"
[[ -f "$RELEASE_DIR/OpenTicket-Installer.exe" ]] && have_exe="true"

if [[ "$have_pkg" != "true" && "$have_dmg" != "true" ]]; then
  echo "release-artifacts-smoke: missing macOS installer artifact (.pkg or .dmg)" >&2
  exit 1
fi
if [[ "$have_exe" != "true" ]]; then
  echo "release-artifacts-smoke: missing Windows installer artifact (.exe)" >&2
  exit 1
fi

node - <<'NODE' "$REPORT_PATH" "$RELEASE_DIR" "${referenced_files[*]}" "$have_pkg" "$have_dmg" "$have_exe"
const fs = require('node:fs');
const [reportPath, releaseDir, refsRaw, havePkg, haveDmg, haveExe] = process.argv.slice(2);
const referencedFiles = refsRaw ? refsRaw.split(' ').filter(Boolean) : [];
const payload = {
  name: 'release-artifacts-smoke',
  status: 'PASS',
  releaseDir,
  referencedFiles,
  installers: {
    pkg: havePkg === 'true',
    dmg: haveDmg === 'true',
    exe: haveExe === 'true',
  },
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2), 'utf-8');
NODE

echo "release-artifacts-smoke: PASS report=$REPORT_PATH"
