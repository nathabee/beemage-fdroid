#!/usr/bin/env bash
# apps/android-native/scripts/env.sh
set -euo pipefail

# Central toolchain bootstrap for BeeMage Android builds.
# Goal: ensure Gradle runs on JDK 17 without relying on user shell config.

choose_java_17_home() {
  # Prefer explicit JAVA_HOME if it's already a 17 JDK
  if [[ -n "${JAVA_HOME:-}" ]] && [[ -x "${JAVA_HOME}/bin/java" ]]; then
    if "${JAVA_HOME}/bin/java" -version 2>&1 | head -n1 | grep -q '\"17'; then
      echo "${JAVA_HOME}"
      return 0
    fi
  fi

  # Debian/Ubuntu default path for OpenJDK 17
  local candidate="/usr/lib/jvm/java-17-openjdk-amd64"
  if [[ -x "${candidate}/bin/java" ]]; then
    echo "${candidate}"
    return 0
  fi

  # Try update-alternatives as a fallback
  if command -v update-alternatives >/dev/null 2>&1; then
    local java_bin
    java_bin="$(update-alternatives --list java 2>/dev/null | grep -m1 'java-17' || true)"
    if [[ -n "${java_bin}" ]]; then
      # strip /bin/java
      echo "${java_bin%/bin/java}"
      return 0
    fi
  fi

  return 1
}

JAVA17_HOME="$(choose_java_17_home || true)"
if [[ -z "${JAVA17_HOME}" ]]; then
  echo "ERROR: JDK 17 not found." >&2
  echo "Install it with: sudo apt install openjdk-17-jdk" >&2
  echo "Then re-run your build." >&2
  exit 1
fi

export JAVA_HOME="${JAVA17_HOME}"
export PATH="${JAVA_HOME}/bin:${PATH}"
