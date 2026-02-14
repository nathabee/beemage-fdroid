# BeeMage F-Droid Source Mirror

This repository is a minimal, Android-focused source mirror of the main BeeMage repository.

Purpose:
- Provide a clean, review-friendly source tree for F-Droid packaging.
- Avoid shipping unrelated code/assets from the main monorepo.
- Keep the Android build reproducible and easy to test with `fdroidserver`.

The canonical development repository is:
- https://github.com/nathabee/beemage

This repository is generated from the canonical repo by a sync script:
- `beemage/scripts/synchronise-fdroid.sh`

## Repository layout

This mirror contains only the parts required to build the Android app:

- `src/`
  Shared BeeMage core sources used by the Android web bundle.

- `apps/android-web/`
  Web bundle (Vite) built and copied into Android assets.

- `apps/android-native/`
  Android wrapper project (Gradle/Android Studio).

It intentionally excludes:
- Browser extension sources
- Demo site build outputs
- Docs, marketing pages, large assets not required for Android
- Release automation for GitHub artifacts outside the Android wrapper

## Developer workflow

### Prerequisites

- `bash`, `rsync`, `git`
- Node.js + npm (for local Android web build testing)
- Android SDK / Android Studio (optional but recommended for debugging)
- Optional for recipe testing: `fdroidserver` (packaging tool)

### Sync from canonical repository

Assuming you keep both repositories next to each other:

```

<workspace>/
beemage/
beemage-fdroid/

````

Run from inside the canonical repo:

```bash
cd ../beemage
./scripts/synchronise-fdroid.sh
````

This updates `../beemage-fdroid` to match the selected source subsets.

### Build locally (Android Studio style)

From this mirror repository:

```bash
# 1) Build web bundle and copy into Android assets
./apps/android-web/scripts/build-android-web.sh

# 2) Build Android wrapper
cd apps/android-native
./gradlew :app:assembleRelease
```

Install/debug with Android Studio if needed.

## F-Droid packaging

F-Droid builds from a git tag. The recommended approach is:

1. Sync this mirror from the canonical repo
2. Commit changes to `beemage-fdroid`
3. Tag a release (example `v0.2.5-fdroid`)
4. Point `fdroiddata` metadata to this repository and tag

### Testing the recipe locally (recommended)

In your `fdroiddata` checkout:

```bash
fdroid readmeta
fdroid lint <appId>
fdroid build -l -v <appId>
```

Replace `<appId>` with your final Android applicationId (e.g. `de.nathabee.beemage`).

Notes:

* The Android build must not require proprietary dependencies or bundled prebuilt binaries.
* F-Droid will sign the APK; your build should work unsigned in CI.

## Versioning policy

This mirror repository is not edited manually.
All changes must come from the canonical repository via the sync script.
