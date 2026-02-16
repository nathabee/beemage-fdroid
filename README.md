# BeeMage F-Droid Source Mirror

## Important Note

Documentation is edited exclusively in the canonical BeeMage repository (`beemage`).

The `beemage-fdroid` repository is a generated mirror.  
Do not modify documentation files directly in the mirror.

## Overview

This repository is a minimal, Android-focused source mirror of the main BeeMage repository.

Purpose:
- Provide a clean, review-friendly source tree for F-Droid packaging.
- Avoid shipping unrelated code/assets from the main monorepo.
- Keep the Android build reproducible and easy to test with `fdroidserver`.

The canonical development repository is:
- https://github.com/nathabee/beemage

This repository is generated from the canonical repo by a sync script:
- `beemage/scripts/synchronise-fdroid.sh`

Here is a corrected and clearer version, keeping it precise and unambiguous:

 

 

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

```

The mirror is normally updated automatically via:

```bash
beemage/scripts/release-all.sh
```


Manual sync using synchronise-fdroid.sh is only required for debugging.
This updates `beemage-fdroid` repository to match the selected source subsets from  `beemage` repository.
 

### Test


see tester.md doc




 
## F-Droid recipe helper (fdroid-template.yml)

This repository includes a developer helper template:

- `apps/android-native/scripts/fdroid-template.yml`

Notes:

- This file is **not** used by the official F-Droid infrastructure.
- Official packaging is done via `fdroiddata` (`metadata/<appId>.yml`).
- We keep it here so the mirror repo always carries the exact recipe values
  that correspond to each `vX.Y.Z-fdroid` tag.


## Versioning policy

This mirror repository is not edited manually.
All changes must come from the canonical repository via the sync script.
