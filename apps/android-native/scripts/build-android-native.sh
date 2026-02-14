#!/usr/bin/env bash
# apps/android-native/scripts/build-android-native.sh
set -euo pipefail 

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
NATIVE_DIR="${ROOT_DIR}/apps/android-native"
OUT_DIR="${ROOT_DIR}/release"

MODE="${1:-all}"         # apk | aab | all
BUILD_TYPE="${2:-release}" # debug | release

[[ -f "${ROOT_DIR}/VERSION" ]] || { echo "VERSION file missing"; exit 1; }
ver="$(tr -d ' \t\r\n' < "${ROOT_DIR}/VERSION")"

cd "${NATIVE_DIR}"

[[ -f "./gradlew" ]] || { echo "Missing ./gradlew in ${NATIVE_DIR}"; exit 1; }
chmod +x ./gradlew

mkdir -p "${OUT_DIR}"

echo "=== build-android-native ==="
echo "Repo:      ${ROOT_DIR}"
echo "Native:    ${NATIVE_DIR}"
echo "Mode:      ${MODE}"
echo "BuildType: ${BUILD_TYPE}"
echo "Version:   ${ver}"
echo "Out:       ${OUT_DIR}"
echo

case "${BUILD_TYPE}" in
  debug|release) ;;
  *)
    echo "Usage: $0 [apk|aab|all] [debug|release]"
    exit 1
    ;;
esac

run_apk() {
  local t="${1}"
  if [[ "$t" == "debug" ]]; then
    ./gradlew :app:assembleDebug
  else
    ./gradlew :app:assembleRelease
  fi

  local apk_dir="app/build/outputs/apk/${t}"
  local apk_src
  apk_src="$(ls -1 "${apk_dir}"/*.apk 2>/dev/null | head -n 1 || true)"

  [[ -n "${apk_src}" ]] || { echo "APK not found in ${apk_dir}/"; exit 1; }

  local dst="${OUT_DIR}/beemage-android-${ver}-${t}.apk"
  cp -f "${apk_src}" "${dst}"
  echo "APK: ${dst}"
}

run_aab() {
  local t="${1}"
  if [[ "$t" == "debug" ]]; then
    echo "AAB is typically release-only. Refusing debug AAB."
    exit 1
  fi

  ./gradlew :app:bundleRelease

  local aab_dir="app/build/outputs/bundle/release"
  local aab_src
  aab_src="$(ls -1 "${aab_dir}"/*.aab 2>/dev/null | head -n 1 || true)"

  [[ -n "${aab_src}" ]] || { echo "AAB not found in ${aab_dir}/"; exit 1; }

  local dst="${OUT_DIR}/beemage-android-${ver}-release.aab"
  cp -f "${aab_src}" "${dst}"
  echo "AAB: ${dst}"
}

case "${MODE}" in
  apk)
    run_apk "${BUILD_TYPE}"
    ;;
  aab)
    run_aab "${BUILD_TYPE}"
    ;;
  all)
    run_apk "${BUILD_TYPE}"
    if [[ "${BUILD_TYPE}" == "release" ]]; then
      run_aab "release"
    else
      echo "Skipping AAB for debug build."
    fi
    ;;
  *)
    echo "Usage: $0 [apk|aab|all] [debug|release]"
    exit 1
    ;;
esac

echo
echo "Android native build done."
