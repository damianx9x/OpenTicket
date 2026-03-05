#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PATTERN='\.(ts|tsx|js|jsx|swift|sh|prisma|sql|css|md)$'

echo "== OpenTicket code metrics =="
echo "Repo: $ROOT_DIR"
echo

echo "[1/3] Files by extension"
git ls-files | rg "$PATTERN" | awk -F. '{print $NF}' | sort | uniq -c | sort -nr
echo

echo "[2/3] Lines by extension"
git ls-files | rg "$PATTERN" | while read -r file; do
  wc -l "$file"
done | awk '{
  ext=$2; sub(/^.*\./,"",ext);
  lines[ext]+=$1; total+=$1
}
END{
  for (e in lines) printf "%8d %s\n", lines[e], e;
  printf "%8d TOTAL\n", total;
}' | sort -nr
echo

echo "[3/3] Top 20 largest source files (lines)"
git ls-files | rg "$PATTERN" | while read -r file; do
  wc -l "$file"
done | sort -nr | head -n 20
