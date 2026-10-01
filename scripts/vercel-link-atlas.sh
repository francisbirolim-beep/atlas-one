#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EXPECTED_PROJECT_ID="prj_dOGqEeiOwVazf4veFYSoxLOaXLCH"
EXPECTED_ORG_ID="team_PltLZgVUYzbffEphnapl8mzy"
EXPECTED_PROJECT_NAME="atlas-one"
PROJECT_FILE=".vercel/project.json"

mkdir -p .vercel

if [ -f "$PROJECT_FILE" ]   && grep -q "\"projectId\":\"$EXPECTED_PROJECT_ID\"" "$PROJECT_FILE"   && grep -q "\"orgId\":\"$EXPECTED_ORG_ID\"" "$PROJECT_FILE"; then
  exit 0
fi

printf '{"projectId":"%s","orgId":"%s","projectName":"%s"}\n'   "$EXPECTED_PROJECT_ID" "$EXPECTED_ORG_ID" "$EXPECTED_PROJECT_NAME" > "$PROJECT_FILE"

echo "Vercel vinculado ao projeto Atlas One."
