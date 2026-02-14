#!/usr/bin/env bash
# apps/android-native/scripts/publish-android-native-artifacts.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ANDROID_DIR="$ROOT_DIR/apps/android-native"
cd "$ROOT_DIR"

die() { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "WARN:  $*" >&2; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }

need git
need gh
need sha256sum

[[ -f VERSION ]] || die "VERSION file missing"
ver="$(tr -d ' \t\r\n' < VERSION)"
[[ -n "$ver" ]] || die "VERSION is empty"
tag="v${ver}"

# Keep same policy as other publish scripts
[[ -z "$(git status --porcelain)" ]] || die "Working tree not clean. Commit/stash first."
gh auth status >/dev/null 2>&1 || die "gh not authenticated. Run: gh auth login"
gh release view "$tag" >/dev/null 2>&1 || die "Release $tag not found. Create it first."

# Signing mode: if keystore.properties exists locally, we assume you want signed artifacts.
SIGNING_CONFIG="$ANDROID_DIR/keystore.properties"
SIGNED="no"
if [[ -f "$SIGNING_CONFIG" ]]; then
  SIGNED="yes"
fi

# Expected filenames in repo-root release/
REL_DIR="$ROOT_DIR/release"
mkdir -p "$REL_DIR"

APK_SIGNED="$REL_DIR/beemage-android-${ver}-release.apk"
APK_UNSIGNED="$REL_DIR/beemage-android-${ver}-release-unsigned.apk"

AAB_SIGNED="$REL_DIR/beemage-android-${ver}-release.aab"
AAB_UNSIGNED="$REL_DIR/beemage-android-${ver}-release-unsigned.aab"

# Helper: pick an artifact path, allowing either naming to exist
pick_existing() {
  local preferred="$1"
  local fallback="$2"
  if [[ -f "$preferred" ]]; then
    echo "$preferred"
  elif [[ -f "$fallback" ]]; then
    echo "$fallback"
  else
    echo ""
  fi
}

# Prefer the correct name for the chosen signing mode.
APK_SRC=""
AAB_SRC=""

if [[ "$SIGNED" == "yes" ]]; then
  APK_SRC="$(pick_existing "$APK_SIGNED" "$APK_UNSIGNED")"
  AAB_SRC="$(pick_existing "$AAB_SIGNED" "$AAB_UNSIGNED")"
else
  APK_SRC="$(pick_existing "$APK_UNSIGNED" "$APK_SIGNED")"
  AAB_SRC="$(pick_existing "$AAB_UNSIGNED" "$AAB_SIGNED")"
fi

[[ -n "$APK_SRC" ]] || die "Missing Android APK in $REL_DIR. Run: ./apps/android-native/scripts/build-android-native.sh apk release"

# AAB is optional for GitHub releases (Play wants it; F-Droid doesn't).
if [[ -z "$AAB_SRC" ]]; then
  warn "Missing AAB in $REL_DIR (ok if you are not shipping to Play)."
fi

# If naming does not match the intended mode, upload with explicit naming via temp copies.
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

APK_UPLOAD="$APK_SRC"
AAB_UPLOAD="$AAB_SRC"

if [[ "$SIGNED" == "yes" ]]; then
  # Ensure uploaded file has the signed filename
  if [[ "$(basename "$APK_SRC")" != "$(basename "$APK_SIGNED")" ]]; then
    cp -f "$APK_SRC" "$TMP_DIR/$(basename "$APK_SIGNED")"
    APK_UPLOAD="$TMP_DIR/$(basename "$APK_SIGNED")"
  fi
  if [[ -n "$AAB_SRC" && "$(basename "$AAB_SRC")" != "$(basename "$AAB_SIGNED")" ]]; then
    cp -f "$AAB_SRC" "$TMP_DIR/$(basename "$AAB_SIGNED")"
    AAB_UPLOAD="$TMP_DIR/$(basename "$AAB_SIGNED")"
  fi
else
  # Ensure uploaded file has the unsigned filename
  if [[ "$(basename "$APK_SRC")" != "$(basename "$APK_UNSIGNED")" ]]; then
    cp -f "$APK_SRC" "$TMP_DIR/$(basename "$APK_UNSIGNED")"
    APK_UPLOAD="$TMP_DIR/$(basename "$APK_UNSIGNED")"
  fi
  if [[ -n "$AAB_SRC" && "$(basename "$AAB_SRC")" != "$(basename "$AAB_UNSIGNED")" ]]; then
    cp -f "$AAB_SRC" "$TMP_DIR/$(basename "$AAB_UNSIGNED")"
    AAB_UPLOAD="$TMP_DIR/$(basename "$AAB_UNSIGNED")"
  fi
fi

# Preflight check (version/sdk + signing if required)
if [[ "$SIGNED" == "yes" ]]; then
  echo "== Preflight: signed mode (keystore.properties present) =="
  "$ANDROID_DIR/scripts/check.sh" --require-signing --apk "$APK_SRC"
else
  echo "== Preflight: unsigned mode (no keystore.properties) =="
  "$ANDROID_DIR/scripts/check.sh" --apk "$APK_SRC"
fi

# Print checksums for audit/debug
echo
echo "== Artifacts to upload =="
echo "$(basename "$APK_UPLOAD") sha256: $(sha256sum "$APK_UPLOAD" | awk '{print $1}')"
if [[ -n "$AAB_UPLOAD" ]]; then
  echo "$(basename "$AAB_UPLOAD") sha256: $(sha256sum "$AAB_UPLOAD" | awk '{print $1}')"
fi
echo

# Upload
if [[ -n "$AAB_UPLOAD" ]]; then
  gh release upload "$tag" "$APK_UPLOAD" "$AAB_UPLOAD" --clobber
else
  gh release upload "$tag" "$APK_UPLOAD" --clobber
fi

echo "Done: uploaded Android artifacts to release $tag."
