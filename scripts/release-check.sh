#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-preview}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Atlas One release preflight: $MODE"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERRO: existem alterações locais não commitadas."
  exit 1
fi

if [ "$MODE" = "production" ]; then
  BRANCH="$(git branch --show-current)"
  if [ "$BRANCH" != "main" ]; then
    echo "ERRO: produção só pode ser publicada a partir da branch main."
    exit 1
  fi

  git fetch origin main --quiet
  LOCAL="$(git rev-parse HEAD)"
  REMOTE="$(git rev-parse origin/main)"
  if [ "$LOCAL" != "$REMOTE" ]; then
    echo "ERRO: a main local não está exatamente igual à origin/main."
    exit 1
  fi
fi

npm run validate

echo "PREFLIGHT_OK"
