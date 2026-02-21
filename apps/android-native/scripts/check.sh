#!/usr/bin/env bash
# apps/android-native/scripts/check.sh
set -euo pipefail

die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
info() { printf '%s\n' "$*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"          # .../apps/android-native
ROOT_DIR="$(cd "$ANDROID_DIR/../.." && pwd)"        # repo root

DO_BUILD="no"
REQUIRE_SIGNING="no"
APK_PATH="" 
PRINT_EXPECTED_VC="no"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build) DO_BUILD="yes"; shift ;;
    --require-signing) REQUIRE_SIGNING="yes"; shift ;;
    --apk) APK_PATH="${2:-}"; shift 2 ;;
    --print-expected-versioncode) PRINT_EXPECTED_VC="yes"; shift ;;
    -h|--help)
      cat <<EOF
Usage: apps/android-native/scripts/check.sh [--build] [--apk <path>] [--require-signing] [--print-expected-versioncode]

Checks:
- VERSION exists and is MAJOR.MINOR.PATCH
- Release APK versionName/versionCode match VERSION-derived expectation
- APK targetSdkVersion=35 and minSdkVersion=24
- If keystore.properties exists:
  - keystore file exists
  - alias exists in keystore
  - APK signature verifies (apksigner)

Options:
--build                      build :app:assembleRelease if no release APK exists
--apk <path>                 explicitly specify APK to inspect
--require-signing            fail if keystore.properties is missing
--print-expected-versioncode print expected versionCode derived from VERSION and exit
EOF
      exit 0
      ;;
    *)
      die "Unknown arg: $1 (use --help)"
      ;;
  esac
done
 
 
# ---- version from repo root ----
[[ -f "$ROOT_DIR/VERSION" ]] || die "VERSION file missing at repo root"
VER="$(tr -d ' \t\r\n' < "$ROOT_DIR/VERSION")"
[[ -n "$VER" ]] || die "VERSION is empty"

IFS='.' read -r MA MI PA <<<"$VER" || true
[[ "${MA:-}" =~ ^[0-9]+$ && "${MI:-}" =~ ^[0-9]+$ && "${PA:-}" =~ ^[0-9]+$ ]] || die "VERSION must be MAJOR.MINOR.PATCH, got: '$VER'"

EXPECTED_VC=$(( (MA + 1) * 1000000 + MI * 1000 + PA ))

# early exit for scripting (must be after parsing VERSION, and before SDK checks)
if [[ "$PRINT_EXPECTED_VC" == "yes" ]]; then
  printf '%s\n' "$EXPECTED_VC"
  exit 0
fi
 
 

info "=== Android checks ==="
info "Repo VERSION:        $VER"
info "Expected versionCode: $EXPECTED_VC"
info "Android dir:         $ANDROID_DIR"
info

cd "$ANDROID_DIR"

# ---- locate SDK tools (aapt/apksigner) ----
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$SDK_ROOT" ]] || die "ANDROID_SDK_ROOT or ANDROID_HOME is not set"

BT_VER="$(ls "$SDK_ROOT/build-tools" 2>/dev/null | sort -V | tail -n 1 || true)"
[[ -n "$BT_VER" ]] || die "No build-tools found under: $SDK_ROOT/build-tools"

AAPT_BIN="$SDK_ROOT/build-tools/$BT_VER/aapt"
APKSIGNER_BIN="$SDK_ROOT/build-tools/$BT_VER/apksigner"

[[ -x "$AAPT_BIN" ]] || die "aapt not executable at: $AAPT_BIN"
[[ -x "$APKSIGNER_BIN" ]] || die "apksigner not executable at: $APKSIGNER_BIN"

# ---- locate APK ----
if [[ -z "$APK_PATH" ]]; then
  APK_PATH="$(ls -1 app/build/outputs/apk/release/*.apk 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "$APK_PATH" && "$DO_BUILD" == "yes" ]]; then
  info "No release APK found. Building :app:assembleRelease ..."
  ./gradlew :app:assembleRelease
  APK_PATH="$(ls -1 app/build/outputs/apk/release/*.apk 2>/dev/null | head -n 1 || true)"
fi

[[ -n "$APK_PATH" ]] || die "Release APK not found. Build it or pass --apk <path> (or use --build)."
[[ -f "$APK_PATH" ]] || die "APK path does not exist: $APK_PATH"

info "APK:                $APK_PATH"

# ---- read APK metadata ----
BADGING="$("$AAPT_BIN" dump badging "$APK_PATH" | tr -d '\r')"

PKG_LINE="$(printf '%s\n' "$BADGING" | grep -m1 '^package: ' || true)"
[[ -n "$PKG_LINE" ]] || die "Could not read package line from APK via aapt"

APK_VC="$(printf '%s\n' "$PKG_LINE" | sed -n "s/.*versionCode='\([^']*\)'.*/\1/p")"
APK_VN="$(printf '%s\n' "$PKG_LINE" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")"

SDK_LINE_MIN="$(printf '%s\n' "$BADGING" | grep -m1 "^sdkVersion:" || true)"
SDK_LINE_TGT="$(printf '%s\n' "$BADGING" | grep -m1 "^targetSdkVersion:" || true)"

APK_MIN_SDK="$(printf '%s\n' "$SDK_LINE_MIN" | sed -n "s/^sdkVersion:'\([^']*\)'.*/\1/p")"
APK_TGT_SDK="$(printf '%s\n' "$SDK_LINE_TGT" | sed -n "s/^targetSdkVersion:'\([^']*\)'.*/\1/p")"

info "APK versionName:     $APK_VN"
info "APK versionCode:     $APK_VC"
info "APK minSdk:          ${APK_MIN_SDK:-unknown}"
info "APK targetSdk:       ${APK_TGT_SDK:-unknown}"
info

# ---- assert versioning ----
[[ "$APK_VN" == "$VER" ]] || die "versionName mismatch: APK=$APK_VN != VERSION=$VER"
[[ "$APK_VC" == "$EXPECTED_VC" ]] || die "versionCode mismatch: APK=$APK_VC != expected=$EXPECTED_VC"

# ---- assert SDK levels ----
# ---- expected SDK levels (single source of truth: gradle.properties) ----
EXPECTED_MIN_SDK="$(grep -E '^[[:space:]]*beemage\.minSdk=' "$ANDROID_DIR/gradle.properties" | tail -n1 | cut -d= -f2 | tr -d ' \t\r\n')"
EXPECTED_TGT_SDK="$(grep -E '^[[:space:]]*beemage\.targetSdk=' "$ANDROID_DIR/gradle.properties" | tail -n1 | cut -d= -f2 | tr -d ' \t\r\n')"

[[ -n "$EXPECTED_MIN_SDK" ]] || die "Missing beemage.minSdk in $ANDROID_DIR/gradle.properties"
[[ -n "$EXPECTED_TGT_SDK" ]] || die "Missing beemage.targetSdk in $ANDROID_DIR/gradle.properties"

[[ "${APK_MIN_SDK:-}" == "$EXPECTED_MIN_SDK" ]] || die "minSdk mismatch: APK=${APK_MIN_SDK:-unknown} != ${EXPECTED_MIN_SDK}"
[[ "${APK_TGT_SDK:-}" == "$EXPECTED_TGT_SDK" ]] || die "targetSdk mismatch: APK=${APK_TGT_SDK:-unknown} != ${EXPECTED_TGT_SDK}"




info "OK: version + sdk level checks passed."
info

# ---- permissions sanity (warn-only) ----
PERMS="$(printf '%s\n' "$BADGING" | grep "^uses-permission:" || true)"

# Only warn for Android system permissions beyond INTERNET.
# Ignore app-defined permissions like: de.nathabee.beemage.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
if [[ -n "$PERMS" ]]; then
  SYSTEM_PERMS="$(printf '%s\n' "$PERMS" \
    | sed -n "s/.*name='\([^']*\)'.*/\1/p" \
    | grep "^android\.permission\." || true)"

  EXTRA_SYSTEM="$(printf '%s\n' "$SYSTEM_PERMS" | grep -v "^android\.permission\.INTERNET$" || true)"

  if [[ -n "$EXTRA_SYSTEM" ]]; then
    warn "APK declares extra *system* permissions (check if intended):"
    printf '%s\n' "$EXTRA_SYSTEM" >&2
    info
  fi
fi


# ---- signing checks ----
KEYSTORE_PROPS="$ANDROID_DIR/keystore.properties"
if [[ -f "$KEYSTORE_PROPS" ]]; then
  info "Signing:            keystore.properties found"

  get_prop() {
    local key="$1"
    grep -E "^[[:space:]]*${key}[[:space:]]*=" "$KEYSTORE_PROPS" \
      | tail -n 1 \
      | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//"
  }

  STORE_FILE="$(get_prop storeFile || true)"
  STORE_PASS="$(get_prop storePassword || true)"
  KEY_ALIAS="$(get_prop keyAlias || true)"
  KEY_PASS="$(get_prop keyPassword || true)"

  [[ -n "$STORE_FILE" ]] || die "keystore.properties missing storeFile="
  [[ -n "$STORE_PASS" ]] || die "keystore.properties missing storePassword="
  [[ -n "$KEY_ALIAS"  ]] || die "keystore.properties missing keyAlias="
  [[ -n "$KEY_PASS"   ]] || die "keystore.properties missing keyPassword="

  if [[ "$STORE_FILE" = /* ]]; then
    KS_PATH="$STORE_FILE"
  else
    KS_PATH="$ANDROID_DIR/$STORE_FILE"
  fi

  [[ -f "$KS_PATH" ]] || die "Keystore file not found: $KS_PATH"
  
  info "Keystore:           present"
  info "Keystore alias:     $KEY_ALIAS"


  # Verify alias exists (uses store password)
  keytool -list -keystore "$KS_PATH" -storepass "$STORE_PASS" -alias "$KEY_ALIAS" >/dev/null
  info "OK: keystore alias exists."

  # Verify APK is signed
  "$APKSIGNER_BIN" verify --verbose "$APK_PATH" >/dev/null
  info "OK: APK signature verified (apksigner)."

  info "Certificate fingerprint (SHA-256):"
  "$APKSIGNER_BIN" verify --print-certs "$APK_PATH" \
    | rg -n "certificate SHA-256 digest" \
    | sed -E 's/^.*certificate SHA-256 digest: /sha256: /'
  info


else
  if [[ "$REQUIRE_SIGNING" == "yes" ]]; then
    die "Signing required but keystore.properties is missing at: $KEYSTORE_PROPS"
  fi
  info "Signing:            keystore.properties not present (OK for F-Droid/CI)."
  info
fi

info "=== All Android checks passed ==="
