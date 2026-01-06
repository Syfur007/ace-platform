#!/usr/bin/env bash
set -euo pipefail

# Prevent frontend or other packages from importing Go backend internals
# Search for the module name or internal paths outside apps/backend
FOUND=0
# Find any occurrences of the Go module path in non-backend files
while IFS= read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  if [[ $file != apps/backend/* ]]; then
    echo "Forbidden backend import: $line"
    FOUND=1
  fi
done < <(git grep -n "github.com/ace-platform/apps/backend" || true)

# Also check for usages of 'internal' import paths (common in Go)
while IFS= read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  if [[ $file != apps/backend/* ]]; then
    echo "Forbidden internal import path: $line"
    FOUND=1
  fi
done < <(git grep -n "internal/" -- "*.ts" "*.tsx" || true)

if [[ $FOUND -ne 0 ]]; then
  echo "Import boundary checks failed" >&2
  exit 2
fi

echo "Import boundary checks passed"