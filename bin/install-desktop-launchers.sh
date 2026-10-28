#!/usr/bin/env bash
# ==============================================================================
# Installs Omachy Desktop .desktop entry files into ~/.local/share/applications/
# No root / sudo required!
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_DIR="${HOME}/.local/share/applications"

mkdir -p "${APP_DIR}"

echo "[omachy] Installing desktop launchers into ${APP_DIR}..."

for f in "${PROJECT_ROOT}/desktop/"*.desktop; do
  if [ -f "$f" ]; then
    cp "$f" "${APP_DIR}/"
    echo "  -> Installed $(basename "$f")"
  fi
done

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${APP_DIR}" 2>/dev/null || true
fi

echo "[omachy] All 6 Omachy application launchers successfully installed in your application menu!"
