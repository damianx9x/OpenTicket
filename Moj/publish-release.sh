#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOJ_DIR="$ROOT_DIR/Moj"
VERSION="$(node -p "require('$ROOT_DIR/desktop/package.json').version")"
TAG="v${VERSION}"
TITLE="OpenTicket ${TAG}"
IS_PRERELEASE=false
if [[ "$VERSION" == *"alpha"* || "$VERSION" == *"beta"* || "$VERSION" == *"rc"* || "$VERSION" == *"pre"* ]]; then
  IS_PRERELEASE=true
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Brak gh CLI. Zainstaluj GitHub CLI i zaloguj się (gh auth login)." >&2
  exit 1
fi

cd "$ROOT_DIR"

required=(
  "$MOJ_DIR/OpenTicket-Installer.pkg"
  "$MOJ_DIR/OpenTicket-Uninstaller.pkg"
  "$MOJ_DIR/latest-mac.yml"
)

for file in "${required[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Brak wymaganego artefaktu: $file" >&2
    echo "Najpierw uruchom build: ./Moj/build-oficjalna-instalka.sh" >&2
    exit 1
  fi
done

assets=(
  "$MOJ_DIR/OpenTicket-Installer.pkg"
  "$MOJ_DIR/OpenTicket-Uninstaller.pkg"
  "$MOJ_DIR/OpenTicket-Installer.dmg"
  "$MOJ_DIR/OpenTicket-Installer.zip"
  "$MOJ_DIR/latest-mac.yml"
  "$MOJ_DIR/latest.yml"
)

# Dodaj pliki updatera wskazane przez latest-mac.yml / latest.yml, jeśli istnieją.
while IFS= read -r candidate; do
  [[ -z "$candidate" ]] && continue
  if [[ -f "$MOJ_DIR/$candidate" ]]; then
    assets+=("$MOJ_DIR/$candidate")
  fi
  if [[ -f "$MOJ_DIR/$candidate.blockmap" ]]; then
    assets+=("$MOJ_DIR/$candidate.blockmap")
  fi
done < <(
  awk '
    /^path:[[:space:]]*/ { print $2 }
    /^[[:space:]]*-[[:space:]]*url:[[:space:]]*/ { print $3 }
  ' "$MOJ_DIR/latest-mac.yml" 2>/dev/null | tr -d '"' | sort -u
)

if [[ -f "$MOJ_DIR/latest.yml" ]]; then
  while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue
    if [[ -f "$MOJ_DIR/$candidate" ]]; then
      assets+=("$MOJ_DIR/$candidate")
    fi
    if [[ -f "$MOJ_DIR/$candidate.blockmap" ]]; then
      assets+=("$MOJ_DIR/$candidate.blockmap")
    fi
  done < <(
    awk '/^path:[[:space:]]*/ { print $2 }' "$MOJ_DIR/latest.yml" | tr -d '"' | sort -u
  )
fi

# Deduplikacja i odfiltrowanie brakujących (bash 3 compatible).
upload_files=()
while IFS= read -r f; do
  [[ -f "$f" ]] && upload_files+=("$f")
done < <(printf '%s\n' "${assets[@]}" | awk '!seen[$0]++')

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG istnieje -> aktualizuję assety"
  gh release upload "$TAG" "${upload_files[@]}" --clobber
else
  echo "Tworzę release $TAG"
  create_args=("$TAG" "${upload_files[@]}" --title "$TITLE" --notes "OpenTicket ${TAG}")
  if [[ "$IS_PRERELEASE" == "true" ]]; then
    create_args+=(--prerelease)
  fi
  gh release create "${create_args[@]}"
fi

REPO_URL="$(git config --get remote.origin.url | sed -E 's#git@github.com:#https://github.com/#; s#\.git$##')"
echo "Gotowe: ${REPO_URL}/releases/tag/${TAG}"
