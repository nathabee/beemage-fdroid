
# BeeMage — Android Web Bundle

This directory builds the **Android-targeted web bundle** for BeeMage.

It reuses the **same application core and UI** as the extension/kernel (`/src`)
and produces a static build that is embedded into the native wrapper
(`apps/android-native`) via a WebView.

This is not an APK/AAB.
It is the web artifact consumed by the Android app.

* Document updated for version: `0.2.3`

---

## Purpose

This build exists to:

- reuse `/src` without modification
- remove all Chrome Extension APIs at build time
- run BeeMage inside Android WebView
- keep processing client-side (no backend)

OpenCV is intentionally disabled in Android v1.

---

## Architecture summary

- `/src` remains the single source of truth
- `apps/android-web` is a Vite host project
- build-time seam swapping replaces extension-only modules
- native JS operations are reused unchanged

High-level structure:

```

src/                     shared kernel (UI + logic)
assets/                  shared assets (pipelines, icons, etc.)

apps/android-web/
index.html
src/main.ts
src/app.ts
src/mocks/             platform seams for Android/WebView
vite.config.ts

```

---

## What is reused from `/src`

- Panel UI (`panel.html`, `panel.css`, `panel.ts`)
- Tabs and view models
- Pipeline runner and typing system
- Native JS operation implementations
- Logging model (action log / debug trace / console trace)

---

## What is replaced for Android (seam swapping)

At build time, these modules are swapped to remove Chrome APIs:

| Original (`/src`)                          | Android replacement (`apps/android-web`) |
|-------------------------------------------|------------------------------------------|
| `src/panel/platform/runtime.ts`           | `src/mocks/runtime.ts`                   |
| `src/shared/platform/storage.ts`          | `src/mocks/storage.ts`                   |
| `src/panel/platform/engineAdapter.ts`     | `src/mocks/engine/engineAdapter.ts`      |

No other modules are replaced.

---

## OpenCV status

- OpenCV is disabled in the Android build
- Any OpenCV request falls back to native JS implementations
- No OpenCV assets are bundled

This keeps the first Android version simple and avoids WebView constraints.

---

## Install

```bash
cd apps/android-web
npm install
```

---

## Build

### Build web bundle only

```bash
cd apps/android-web
npm run build
```

Output:

```
apps/android-web/dist/
  index.html
  app/
    panel.html
    panel.css
  assets/
    *.js
    pipelines/*.json
```

### Build and copy into the native wrapper (recommended)

From repo root:

```bash
apps/android-web/scripts/build-android-web.sh
```

This script:

1. builds `apps/android-web/dist/`
2. copies it into `apps/android-native/app/src/main/assets/`

---

## Development server

```bash
cd apps/android-web
npm run dev -- --host
```

Notes:

* Runs in a standard browser or via a device on the LAN
* No Chrome APIs required

---

## Assets

### Panel HTML/CSS

Sourced from:

* `src/panel/panel.html`
* `src/panel/panel.css`

Sanitized at build time (extension-only script tags removed) and emitted as:

* `dist/app/panel.html`
* `dist/app/panel.css`

### Pipeline JSON files

Source of truth:

```
assets/pipelines/**/*.json
```

Bundled into:

```
dist/assets/pipelines/
```

---

## Persistence

* Uses `localStorage` via the Android storage mock
* Persists:

  * user pipelines / recipes
  * tuning overrides
  * UI state
* Images are not persisted

---

## Known limitations (v1)

* File export uses browser-style downloads (wrapper integration pending)
* No Android share/save integration yet
* No camera import yet
* No OpenCV acceleration

These are handled at the wrapper layer (`apps/android-native`).

---

## Next step

See:

* `apps/android-native/README.md`

That document explains how this bundle is embedded into a real Android app
and how APK/AAB artifacts are built for release.
 