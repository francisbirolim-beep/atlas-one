#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bash scripts/release-check.sh preview
npx -y vercel@latest deploy --yes --scope francisbirolim-beeps-projects
