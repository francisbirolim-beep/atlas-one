#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bash scripts/vercel-link-atlas.sh
bash scripts/release-check.sh production
npx -y vercel@latest deploy --prod --yes --scope francisbirolim-beeps-projects
