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

## Tool installation


### 0. Install adb

On Debian/Ubuntu:
Optional: platform-tools (adb)

 
```bash
sudo apt install -y adb
```

edit .bashrc , add:

export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
 


### 1. Cleanup (if necessary)

Run these commands to remove all the conflicting "broken" versions of F-Droid.

```bash
# 1. Remove the old APT version (This is the one causing the hash errors)
sudo apt purge -y fdroidserver
sudo apt autoremove -y

# 2. Ensure pipx hasn't left ghosts behind
pipx uninstall fdroidserver || true
rm -rf ~/.local/share/pipx/venvs/fdroidserver
rm -f ~/.local/bin/fdroid

# 3. Refresh your shell's command memory
hash -r

```

---

### 2. The "Once in a Lifetime" Installation (The 2026 Way)

We are going to use a **Python Virtual Environment**. This keeps the "good" F-Droid tools separate from your system Python 3.12, fixing the `pkg_resources` error.

```bash
# 1. Install System Dependencies (Java and Python Venv)
sudo apt update
sudo apt install -y openjdk-17-jdk python3-venv python3-pip git rsync

# 2. Create a PERMANENT folder for your F-Droid Tools
mkdir -p ~/fdroid-tools
cd ~/fdroid-tools

# 3. Create the Virtual Environment
python3 -m venv venv

# 4. Activate it
source venv/bin/activate

# 5. Upgrade the core Python tools (Fixes pkg_resources)
pip install --upgrade pip setuptools wheel

# 6. Install the LATEST fdroidserver from source
# This version knows all the new Gradle hashes (7.6.3, 8.x, 9.x)
pip install git+https://gitlab.com/fdroid/fdroidserver.git

# 7. Verify the version - Should be 2.4.3 or higher
fdroid --version
```


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

Since we are using a Virtual Environment, you must **activate it** before running your tests. Change your commands to this:

---

### 1) Create a clean test workspace

```bash
# ALWAYS ACTIVATE YOUR TOOL FIRST
source ~/fdroid-tools/venv/bin/activate

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
cd ~/coding/test/fdroid

mkdir fdroiddata-local
cd fdroiddata-local

# source ~/fdroid-tools/venv/bin/activate
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
* checkout `v0.2.6-fdroid`
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
 



## EXAMPLE OFUNIT TEST WORKFLOW
 

### context 
 when we test the workflow in unit test, we may want to make some change in beemage and test fdroid again
 as long as it is not stabil, we do not send data in fdroiddata, so the label can be removed
 let say we want to package 0.2.6 and it may tale alots of rerun

so we make unit test on the version 0.2.6 in the beemage-fdroid, for this we need to make the version 0.2.6 in beemage
so we will need to correct 0.2.6 and strat again our test on the same version
---
 
### ROLE BACK a version that we already have pushed in github
 
after making the version 0.2.6, i want to redo again and go back to 0.2.5 for example
hiere would be the commands to redo version after fail creation v0.2.6 :

#### In beemage-fdroid (mirror) 

run :

```bash
git push --delete origin v0.2.6-fdroid || true 
git tag -d v0.2.6-fdroid || true 
```


#### In beemage ( canonical) run :
 
- erase old 0.2.6
- correct the code in 0.2.6
- re-push the version 0.2.6 after correction in beemage and synchronise the beemage-fdroid repository:

run :

```bash
# delete GitHub releases (if they exist)
gh release delete v0.2.6 -y || true 
# delete remote tags
git push --delete origin v0.2.6 || true 
# delete local tags
git tag -d v0.2.6 || true 
echo "0.2.5" > VERSION
scripts/bump-version.sh patch
scripts/release-all.sh
```

### UNIT TEST WORKFLOW (NEW)

```bash
# 1. Environment and Cleanup
source ~/fdroid-tools/venv/bin/activate
rm -rf ~/coding/test/fdroid
mkdir -p ~/coding/test/fdroid
cd ~/coding/test/fdroid

# 2. Init
fdroid init

# 3. Fix Config (Remove the system gradle path!)
# We want F-Droid to use your ./gradlew
cat <<EOF >> config.yml
lint_ignore:
    - UnknownCategory
    - NoNewLineAtEndOfFile
EOF

# 4. Clone & Checkout
mkdir -p build
git clone https://github.com/nathabee/beemage-fdroid.git build/de.nathabee.beemage
cd build/de.nathabee.beemage && git checkout v0.2.6-fdroid && cd ~/coding/test/fdroid

# 5. Metadata
mkdir -p metadata
cp build/de.nathabee.beemage/apps/android-native/scripts/fdroid-template.yml \
   metadata/de.nathabee.beemage.yml

# 6. Build
fdroid readmeta
fdroid build -v -l --no-tarball de.nathabee.beemage

```
 
### UNIT TEST WORKFLOW (OLD)

```bash
# 1. Environment and Cleanup
source ~/fdroid-tools/venv/bin/activate
rm -rf ~/coding/test/fdroid
mkdir -p ~/coding/test/fdroid
cd ~/coding/test/fdroid

# 2. Init
fdroid init

# 3. Fix Config (Use the local auto-generated keys)
cat <<EOF >> config.yml
gradle: /usr/bin/gradle
lint_ignore:
    - UnknownCategory
    - NoNewLineAtEndOfFile
EOF

# 4. Setup Source
mkdir -p build
git clone https://github.com/nathabee/beemage-fdroid.git build/de.nathabee.beemage
cd build/de.nathabee.beemage && git checkout v0.2.6-fdroid && cd ~/coding/test/fdroid

# 5. Metadata (CRITICAL: Make sure this file exists before building)
mkdir -p metadata
cp ~/coding/test/fdroid/build/de.nathabee.beemage/apps/android-native/scripts/fdroid-template.yml \
   metadata/de.nathabee.beemage.yml

# 6. Build
fdroid readmeta
fdroid build -v -l --no-tarball de.nathabee.beemage
```

### UNIT TEST WORKFLOW (OLD)

```bash
# 1. Environment and Cleanup
source ~/fdroid-tools/venv/bin/activate
rm -rf ~/coding/test/fdroid
mkdir -p ~/coding/test/fdroid
cd ~/coding/test/fdroid

# 2. Initialize (Let F-Droid generate the real local keys/passwords)
fdroid init

# 3. Add only the missing pieces (Append)
# We don't touch keystorepass or keypass; we let F-Droid use its own.
cat <<EOF >> config.yml
gradle: /usr/bin/gradle
lint_ignore:
    - UnknownCategory
    - NoNewLineAtEndOfFile
EOF

# 4. Setup Source
mkdir -p build
git clone https://github.com/nathabee/beemage-fdroid.git build/de.nathabee.beemage
cd build/de.nathabee.beemage && git checkout v0.2.6-fdroid && cd ~/coding/test/fdroid

# 5. Metadata
mkdir -p metadata
cp build/de.nathabee.beemage/apps/android-native/scripts/fdroid-template.yml \
   metadata/de.nathabee.beemage.yml

# 6. Run Build
fdroid readmeta
fdroid build -v -l --no-tarball de.nathabee.beemage

```


### UNIT TEST WORKFLOW (OLD)

```bash

# exit and comm back in new terminal window
exit

# 1. Environment and Cleanup
source ~/fdroid-tools/venv/bin/activate
rm -rf ~/coding/test/fdroid
mkdir -p ~/coding/test/fdroid
cd ~/coding/test/fdroid

# 2. Initialize F-Droid first
fdroid init

# 3. Clone directly into the standard F-Droid build folder
mkdir -p build
git clone https://github.com/nathabee/beemage-fdroid.git build/de.nathabee.beemage

cd build/de.nathabee.beemage
git checkout v0.2.6-fdroid
cd ~/coding/test/fdroid

# 4. Fix Config
echo "" >> config.yml
echo "lint_ignore:" >> config.yml
echo "    - UnknownCategory" >> config.yml
echo "    - NoNewLineAtEndOfFile" >> config.yml

# 4. Update Config with Gradle and Key info
cat <<EOF >> config.yml
gradle: /usr/bin/gradle
keystorepass: EfVdIGcU2E9/6UMLWJy2IFs5kz+IIQLx4QJ9V0KWSmE=
keypass: EfVdIGcU2E9/6UMLWJy2IFs5kz+IIQLx4QJ9V0KWSmE=
EOF

# 5. Copy Metadata (Using the correct internal path)
mkdir -p metadata
cp build/de.nathabee.beemage/apps/android-native/scripts/fdroid-template.yml \
   metadata/de.nathabee.beemage.yml

# 6. Run Build
fdroid readmeta
fdroid build -v -l --no-tarball de.nathabee.beemage
```

 ### TEST WORKFLOWCOMMANDS FDROIDFATA (OLD)

``` bash

clear 
# 1. Environment and Cleanup
source ~/fdroid-tools/venv/bin/activate
rm -rf ~/coding/test/fdroid
mkdir -p ~/coding/test/fdroid/fdroiddata-local/build
cd ~/coding/test/fdroid

# 2. Clone and Checkout
git clone https://github.com/nathabee/beemage-fdroid.git \
    fdroiddata-local/build/de.nathabee.beemage

cd fdroiddata-local/build/de.nathabee.beemage
git checkout v0.2.6-fdroid
cd ../..

# 3. Initialize F-Droid
# This creates the config.yml with the correct sdk_path automatically
fdroid init

# 4. FIX CONFIG (Avoid duplicates!)
# We only append the lint_ignore, which fdroid init does NOT create
echo "lint_ignore:" >> config.yml
echo "    - UnknownCategory" >> config.yml
echo "    - NoNewLineAtEndOfFile" >> config.yml

# 5. Copy Metadata
mkdir -p metadata
cp fdroiddata-local/build/de.nathabee.beemage/apps/android-native/scripts/fdroid-template.yml \
   metadata/de.nathabee.beemage.yml

# 6. Build
fdroid readmeta
fdroid build -v -l --no-tarball de.nathabee.beemage

``` 