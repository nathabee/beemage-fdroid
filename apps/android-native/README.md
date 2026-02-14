# BeeMage — Android Native Wrapper

This directory contains the **Android app project** (Gradle / Android Studio).
It embeds the BeeMage **Android web bundle** into a native app using a `WebView`.

This directory is the **packaging layer**:
APK/AAB outputs come from here.

* Document updated for version: `0.2.3`

---

## Responsibility boundary

### This wrapper is responsible for

- Hosting the `WebView`
- Loading web assets via `WebViewAssetLoader`
- Enforcing WebView security settings
- Wiring Android lifecycle to the web app
- Android integrations (share intents, file save, camera, permissions) when added

### This wrapper is not responsible for

- UI logic
- Image processing and pipeline logic
- Business rules
- Web build tooling

All application logic lives in the shared kernel (`/src`) and is hosted for Android by `apps/android-web`.

---

## Input

The wrapper consumes exactly one artifact:

```

apps/android-web/dist/

```

At build time, that directory is copied into:

```

apps/android-native/app/src/main/assets/

```

Nothing inside `app/src/main/assets/` should be committed (except optional `.gitkeep`).

---

## Build (CLI, reproducible)

From repo root:

```bash
# Release APK + AAB
apps/android-native/scripts/build-android-native.sh

# Only APK (typical for F-Droid local testing)
apps/android-native/scripts/build-android-native.sh apk release

# Debug APK (fast dev loop)
apps/android-native/scripts/build-android-native.sh apk debug
```

### What the script does

1. Builds `apps/android-web` (Vite)
2. Copies `apps/android-web/dist/` into `apps/android-native/app/src/main/assets/`
3. Runs Gradle tasks to produce APK and/or AAB
4. Copies the outputs into repo-root `release/`

---

## Outputs

After a successful build, artifacts are copied to:

```
release/
  beemage-android-release-<version>.apk
  beemage-android-release-<version>.aab
```

Debug builds (if requested) follow the same naming scheme with `debug`.

---

## Release signing (local-only)

Release builds can be produced in two modes:

* **Unsigned release APK/AAB** (default): works without any secrets (good for F-Droid builds and CI sanity checks).
* **Signed release APK/AAB** (optional): needed if you want to distribute your own APK via GitHub Releases outside F-Droid.

This repo **does not** include signing secrets. The following files must **never** be committed:

* `apps/android-native/keystore.properties`
* `apps/android-native/*.jks` (or any keystore file)

### Create a local keystore (one-time)

From `apps/android-native/`:

```bash
keytool -genkeypair -v \
  -keystore beemage-release.jks \
  -alias beemage \
  -keyalg RSA -keysize 4096 \
  -validity 10000
```

### Configure signing locally

Create `apps/android-native/keystore.properties` (not committed):

```properties
storeFile=beemage-release.jks
storePassword=YOUR_PASSWORD
keyAlias=beemage
keyPassword=YOUR_PASSWORD
```

Notes:

* If you used a single password when creating the keystore, `storePassword` and `keyPassword` are the same.

### Verify

```bash
apps/android-native/scripts/check.sh --require-signing
```

If `keystore.properties` is missing, the build will still succeed but the release APK will be **unsigned** (expected for F-Droid).

---

---

## Publishing

### GitHub Release artifacts (signed vs unsigned)

Android artifacts are uploaded by:

```bash
apps/android-native/scripts/publish-android-native-artifacts.sh
```

Upload mode is automatic:

* If `apps/android-native/keystore.properties` exists:

  * publish **signed** artifacts
  * enforce signing and correctness checks via:

    ```bash
    apps/android-native/scripts/check.sh --require-signing
    ```

* If `apps/android-native/keystore.properties` does not exist (CI / F-Droid-like):

  * publish **unsigned** artifacts
  * uploaded filenames include `-unsigned` to make the status explicit

In all cases, the publish script validates that the release APK matches the repo `VERSION`
(`versionName`, `versionCode`) and the expected SDK levels (`minSdk`, `targetSdk`).


### F-Droid

F-Droid builds from source and signs the APK themselves.

Practical requirements:

* The **release build must not require a signing keystore** to succeed.
* The build must be reproducible (no network downloads during Gradle beyond dependencies; deterministic web build step).

Recommended approach:

* Ensure `apps/android-web/scripts/build-android-web.sh` is the only pre-step.
* Build command (conceptually):

  * web prebuild: build web + copy assets
  * gradle build: `./gradlew :app:assembleRelease`

You can validate locally with:

```bash
apps/android-native/scripts/build-android-native.sh apk release
```

If it builds without signing credentials, you’re F-Droid-compatible at the wrapper level.

### Google Play

Google Play expects an **AAB** (bundle):

```bash
apps/android-native/scripts/build-android-native.sh aab release
```

Signing model:

* Typically you sign the upload bundle with an **upload key** (Play App Signing).
* Keep signing configuration conditional (for CI/local Play builds), and keep the ability to build without signing for F-Droid.

---

## Asset loading

Assets are served via:

```
https://appassets.androidplatform.net/
```

using:

* `WebViewAssetLoader`
* `AssetsPathHandler("/")`

This avoids `file://` URLs and makes relative asset paths behave normally.

---

## Local-only files

These are machine-local and must not be committed:

* `local.properties`
* `.gradle/`
* `**/build/`

They should already be covered by `.gitignore`.

---

## When you need to modify this directory

You touch the native wrapper when you need Android features:

* File import/export integrated with Android storage APIs
* Share intents
* Camera integration
* Permissions
* Native acceleration or bindings (future)

If you are working on UI/pipelines/core logic:
do it in `/src` (and sometimes `apps/android-web` for platform seams), not here.

---

## Related documentation

* `apps/android-web/README.md` — the Android web bundle host
* `docs/android.md`  — higher-level Android architecture notes

