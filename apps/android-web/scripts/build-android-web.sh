#!/usr/bin/env bash
# apps/android-web/scripts/build-android-web.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WEB_DIR="${ROOT_DIR}/apps/android-web"
WRAPPER_ASSETS_DIR="${ROOT_DIR}/apps/android-native/app/src/main/assets"

echo "=== build-android-web ==="
echo "Repo:    ${ROOT_DIR}"
echo "Web:     ${WEB_DIR}"
echo "Assets:  ${WRAPPER_ASSETS_DIR}"
echo

[[ -f "${WEB_DIR}/package-lock.json" ]] || {
  echo "ERROR: apps/android-web/package-lock.json missing. Required for reproducible builds (npm ci)."
  exit 1
}

# 1) Build the Android web bundle
(
  cd "${WEB_DIR}"
  npm ci
  npm run build
)

# 2) Replace wrapper assets with the freshly built dist
mkdir -p "${WRAPPER_ASSETS_DIR}"

# Clear old assets to avoid stale hashed JS files (keep .gitkeep if present)
if [[ -d "${WRAPPER_ASSETS_DIR}" ]]; then
  find "${WRAPPER_ASSETS_DIR}" -mindepth 1 -maxdepth 1 ! -name ".gitkeep" -exec rm -rf {} +
fi

cp -Ra "${WEB_DIR}/dist/." "${WRAPPER_ASSETS_DIR}/"

echo
echo "Copied bundle into wrapper assets: ${WRAPPER_ASSETS_DIR}"
echo "Done."
