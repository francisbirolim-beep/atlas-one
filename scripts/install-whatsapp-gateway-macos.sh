#!/bin/zsh
set -euo pipefail

LABEL="com.esquadrifacio.atlas-whatsapp-gateway"
HOME_DIR="${HOME}"
ATLAS_DIR="${HOME_DIR}/.atlas-one"
RUNTIME_DIR="${ATLAS_DIR}/gateway"
LOG_DIR="${ATLAS_DIR}/logs"
PLIST="${HOME_DIR}/Library/LaunchAgents/${LABEL}.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"

if [[ -z "$NODE_BIN" || -z "$NPM_BIN" ]]; then
  echo "Node.js/npm nao encontrados no PATH."
  exit 1
fi

if [[ ! -f "${ATLAS_DIR}/whatsapp-gateway.env" ]]; then
  echo "Arquivo ${ATLAS_DIR}/whatsapp-gateway.env nao encontrado."
  exit 1
fi

mkdir -p "${RUNTIME_DIR}/scripts" "${LOG_DIR}" "${HOME_DIR}/Library/LaunchAgents"
cp "${SCRIPT_DIR}/whatsapp-gateway.mjs" "${RUNTIME_DIR}/scripts/whatsapp-gateway.mjs"
cp "${SCRIPT_DIR}/patch-baileys-pairing.mjs" "${RUNTIME_DIR}/scripts/patch-baileys-pairing.mjs"

cat > "${RUNTIME_DIR}/package.json" <<'JSON'
{
  "name": "atlas-one-whatsapp-gateway",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "postinstall": "node scripts/patch-baileys-pairing.mjs",
    "start": "node scripts/whatsapp-gateway.mjs"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^7.0.0-rc14",
    "qrcode": "^1.5.4"
  }
}
JSON

(
  cd "${RUNTIME_DIR}"
  "$NPM_BIN" install --omit=dev
)

cat > "${PLIST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${RUNTIME_DIR}/scripts/whatsapp-gateway.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${RUNTIME_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/whatsapp-gateway.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/whatsapp-gateway.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key>
    <string>${HOME_DIR}</string>
  </dict>
</dict>
</plist>
PLIST

chmod 600 "${ATLAS_DIR}/whatsapp-gateway.env"
launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "${PLIST}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Atlas One WhatsApp Gateway instalado e iniciado."
echo "Logs: ${LOG_DIR}/whatsapp-gateway.out.log"