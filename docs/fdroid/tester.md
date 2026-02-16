# Testing deliverable for F-Droid

This document describes how to validate the Android build and F-Droid recipe **before** submitting anything to F-Droid.

## Important Note

Documentation is edited exclusively in the canonical BeeMage repository (`beemage`).

The `beemage-fdroid` repository is a generated mirror.  
Do not modify documentation files directly in the mirror.
 
---

## Repository Roles

This project uses three repositories with distinct responsibilities.

### 1) Canonical Repository

[https://github.com/nathabee/beemage](https://github.com/nathabee/beemage)

Primary development repository.

* Full monorepo (extension, demo, Android)
* Versioning (`VERSION`)
* Release tags: `vX.Y.Z`
* All development happens here
* F-Droid mirror is generated from here

Source of truth.

---

### 2) F-Droid Mirror Repository

[https://github.com/nathabee/beemage-fdroid](https://github.com/nathabee/beemage-fdroid)

Minimal Android-only mirror.

* Contains only:

  * `VERSION`
  * `src/`
  * `apps/android-web/`
  * `apps/android-native/`
* Tagged as: `vX.Y.Z-fdroid`
* Automatically synchronised
* Never edited manually

Used by F-Droid for reproducible builds.

---

### 3) fdroiddata (Packaging Repository)

[https://gitlab.com/nathabee/fdroiddata](https://gitlab.com/nathabee/fdroiddata)

F-Droid metadata repository.

* Contains `metadata/<appId>.yml`
* References a tag from `beemage-fdroid`
* Merge Request here triggers F-Droid review

Does not contain your source code.

---

**Flow**

`beemage → beemage-fdroid → fdroiddata → F-Droid build`



---

## STEP 1 — Unit & Android Build Test (Canonical Repo)

This step must already be completed in the main repository (`beemage`) before synchronising the mirror.

You must verify:

* Android app builds successfully in Android Studio
* `./apps/android-native/scripts/build-android-native.sh` works
* Web bundle builds correctly and is copied into `assets/`
* No proprietary dependencies are used

This ensures the application itself is correct before testing the F-Droid packaging layer.

---

## STEP 2 — Test the F-Droid Recipe (Mirror Only)

⚠️ Always test in a **separate directory**, not inside your working mirror repo.
This guarantees reproducibility and avoids pollution.
This step will be used to check that the mirrored repository contains the full deliverable and that the recipe is valide

---

### 0) Install required tooling (if not already installed)

On Debian/Ubuntu:

```bash
sudo apt update
sudo apt install -y fdroidserver openjdk-17-jdk git rsync python3 python3-yaml
```

Optional (may already be provided by Android Studio):

```bash
sudo apt install -y android-sdk-platform-tools android-sdk-build-tools
```

You must also have an Android SDK installed (usually via Android Studio).

If necessary:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_SDK_ROOT/platform-tools"
```

---

### 1) Create a clean test workspace

```bash
mkdir -p ~/coding/test/fdroid
cd ~/coding/test/fdroid
```




---

### 2) Clone the mirror at the exact tag you want to test

```bash
git clone https://github.com/nathabee/beemage-fdroid.git
cd beemage-fdroid
# if you want to test the version v0.2.5 : (adapt the version to te one you want)
git checkout v0.2.5-fdroid
```

You must always test from a tag.
F-Droid builds from tags, not branches.

---

### Recreate Local `fdroiddata` Test Repo

From scratch:

```bash
mkdir -p ~/coding/test/fdroid
cd ~/coding/test/fdroid

mkdir fdroiddata-local
cd fdroiddata-local

fdroid init
```

This will:

* create `config.yml`
* generate a local signing keystore
* create `metadata/` and `repo/` directories

Nothing is published anywhere. This is purely local.

---

### Add Your App Metadata Again

Now create the metadata file:

```bash
mkdir -p metadata

cp ../beemage-fdroid/apps/android-native/scripts/fdroid-template.yml    metadata/de.nathabee.beemage.yml
```

(Adjust path if needed.)

---

## STEP 3 — Test via fdroiddata (CI-Equivalent Validation)

This step verifies that your recipe works in the official F-Droid structure.

Clone your **fork** of `fdroiddata` (GitLab).

Place your metadata file in:

```bash
fdroid readmeta
fdroid lint de.nathabee.beemage
fdroid build -v -l de.nathabee.beemage
```

That will:

* clone `beemage-fdroid`
* checkout `v0.2.5-fdroid`
* run prebuild (android-web build)
* run Gradle

Exactly like CI would.

 
Options explained:

* `-l` → local build only (no publishing)


* No MR is created automatically
* Nothing is uploaded anywhere

Only when you:

1. Commit to your fork
2. Push to GitLab
3. Open a Merge Request

does anything become visible to F-Droid maintainers.

---
 