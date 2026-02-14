#!/usr/bin/env bash
set -euo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "$*"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ANDROID_DIR="$ROOT_DIR/apps/android-native"

# Prefer android-native fastlane if you use it, otherwise fall back to repo root fastlane.
FASTLANE_BASE=""
if [[ -d "$ANDROID_DIR/fastlane/metadata/android" ]]; then
  FASTLANE_BASE="$ANDROID_DIR/fastlane/metadata/android"
elif [[ -d "$ROOT_DIR/fastlane/metadata/android" ]]; then
  FASTLANE_BASE="$ROOT_DIR/fastlane/metadata/android"
else
  # default target if none exists yet
  FASTLANE_BASE="$ANDROID_DIR/fastlane/metadata/android"
fi

LOCALE="en-US"

VC="$("$ANDROID_DIR/scripts/check.sh" --print-expected-versioncode)"
[[ -n "$VC" ]] || die "Could not compute expected versionCode"

OUT_DIR="$FASTLANE_BASE/$LOCALE/changelogs"
OUT_FILE="$OUT_DIR/$VC.txt"

mkdir -p "$OUT_DIR"

if [[ -f "$OUT_FILE" ]]; then
  info "OK: changelog exists: $OUT_FILE"
  exit 0
fi

# interactive input
info "Missing F-Droid changelog: $OUT_FILE"
info "Enter release notes (max 500 chars). Finish with an empty line."
info "Example:"
info "  Android release pipeline hardened: deterministic versioning, HTTPS-only, and improved checks."

TEXT=""
while IFS= read -r line; do
  [[ -z "$line" ]] && break
  TEXT+="${line}"$'\n'
done

TEXT="$(printf "%s" "$TEXT" | sed -e 's/[[:space:]]*$//')"
[[ -n "$TEXT" ]] || die "Empty changelog text"

LEN="$(printf "%s" "$TEXT" | wc -c | tr -d ' ')"
(( LEN <= 500 )) || die "Changelog too long: ${LEN} chars (max 500)"

printf "%s\n" "$TEXT" > "$OUT_FILE"
info "Wrote: $OUT_FILE"
info "Next: git add + commit this before tagging, otherwise F-Droid won't see it."
