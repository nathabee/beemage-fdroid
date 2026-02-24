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
### 3. gradle 

```bash

# Create directory if not exists
sudo mkdir -p /opt/gradle

# Download Gradle 8.13
wget https://services.gradle.org/distributions/gradle-8.13-bin.zip

# Unzip
sudo unzip -d /opt/gradle gradle-8.13-bin.zip

# Verify the version
/opt/gradle/gradle-8.13/bin/gradle -v
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
To DO


```


---

### 2) Clone the mirror at the exact tag you want to test

```bash
To DO

```

You must always test from a tag.
F-Droid builds from tags, not branches.

---

### Recreate Local `fdroiddata` Test Repo

From scratch:

```bash 
To DO

```

This will:

* create `config.yml`
* generate a local signing keystore
* create `metadata/` and `repo/` directories

Nothing is published anywhere. This is purely local.

---

### Add Your App Metadata Again

Now edit the metadata file, containing the configuration of our fdroid server:

```bash
cd ~/coding/test/fdroid
nano config.yml 

```
 
# edit the config.yml to set/add the lines: 
 


gradle: /opt/gradle/gradle-8.13/bin/gradle
repo_url	http://<192.168.xxx.xx>:8080/repo
repo_name	Nathabee Test Repo
repo_description	Local test repository for Nathabee development.
sdk_path: $ANDROID_HOME
sdk_path: /home/nathabee/Android/Sdk 
lint_ignore:
    - UnknownCategory
        - NoNewLineAtEndOfFile
        



(Adjust path if needed.)

---

## STEP 3 — Test via fdroiddata (CI-Equivalent Validation)

This step verifies that your recipe works in the official F-Droid structure.

Clone your **fork** of `fdroiddata` (GitLab).

Place your metadata file in:

```bash
To DO
```

That will:

* clone `beemage-fdroid`
* checkout `v0.2.7-fdroid`
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
 let say we want to package 0.2.7 and it may tale alots of rerun

so we make unit test on the version 0.2.7 in the beemage-fdroid, for this we need to make the version 0.2.7 in beemage
so we will need to correct 0.2.7 and strat again our test on the same version
---
 
### ROLE BACK a version that we already have pushed in github
 
after making the version 0.2.7, i want to redo again and go back to 0.2.6 for example
hiere would be the commands to redo version after fail creation v0.2.7 :

#### In beemage-fdroid (mirror) 

run :

```bash
git push --delete origin v0.2.7-fdroid || true 
git tag -d v0.2.7-fdroid || true 
```

 
#### In beemage ( canonical) run :

run :

```bash
# delete GitHub releases (if they exist)
gh release delete v0.2.7 -y || true 
# delete remote tags
git push --delete origin v0.2.7 || true 
# delete local tags
git tag -d v0.2.7 || true 
echo "0.2.6" > VERSION
scripts/bump-version.sh patch
scripts/release-all.sh
```

### UNIT TEST WORKFLOW 


#### Workflow 1:  DROP-RECREATE FDROIDSERVER AND ADD NEW APP

here we create the fdroidserver from scratch (prerequise : venv exists already)
then he get from github the code and build app into apk
server is configured and started


```bash
# 1. Environment and Cleanup
source ~/fdroid-tools/venv/bin/activate
rm -rf ~/coding/test/fdroid
mkdir -p ~/coding/test/fdroid
cd ~/coding/test/fdroid

# 2. Init the fdroid server
fdroid init

# 3. Update config.yml (Fixed echo syntax with colons)
sed -i 's|sdk_path: $ANDROID_HOME|sdk_path: /home/nathabee/Android/Sdk|' config.yml
echo -e "lint_ignore:\n    - UnknownCategory\n    - NoNewLineAtEndOfFile" >> config.yml 
sed -i 's|^# gradle:.*|gradle: /opt/gradle/gradle-8.13/bin/gradle|' config.yml

# IMPORTANT: Added colons after keys for valid YAML
echo  -e "repo_url: http://192.168.178.27:8080/repo" >> config.yml
echo  -e "repo_name: Nathabee Test Repo" >> config.yml
echo  -e "repo_description: Local test repository for Nathabee development." >> config.yml
echo  -e "repo_icon: nathabee.png" >> config.yml

# copy repository icon inside repo/icons/
cp -p ~/coding/test/beebot_transparent.png ~/coding/test/fdroid/repo/icons/repo-icon.png


# 4. Clone & Checkout
mkdir -p build
git clone https://github.com/nathabee/beemage-fdroid.git build/de.nathabee.beemage
cd build/de.nathabee.beemage && git checkout v0.2.7-fdroid && cd ~/coding/test/fdroid

# 5. Metadata
mkdir -p metadata
cp build/de.nathabee.beemage/apps/android-native/scripts/fdroid-template.yml metadata/de.nathabee.beemage.yml 
# Clean invisible characters immediately
sed -i 's/\xc2\xa0/ /g' metadata/de.nathabee.beemage.yml

# 6. Build
fdroid readmeta
fdroid build -v -l --no-tarball de.nathabee.beemage

# 7. THE MISSING STEP: SIGNING
# This moves the APK from build/ to repo/ AND signs it with your keystore.p12
fdroid publish de.nathabee.beemage

# 8. Update Index
fdroid update --create-metadata --verbose

# 9. Start Server from ROOT (to match http://IP:8080/repo)
cd ~/coding/test/fdroid
python3 -m http.server 8080

```




This is a great way to organize your development. Having a clean "factory reset" script versus a "fast update" script will save you hours of troubleshooting.

One quick detail for your scripts: In your `config.yml` section, I changed `echo` to `sed` or `grep` checks. Using `echo >>` repeatedly on an existing file can accidentally double up your configuration lines.

---

#### Workflow 2:  DROP-RECREATE FDROIDSERVER

**Goal:** Reset the server infrastructure without necessarily re-cloning the app code if you already have it, or simply cleaning the environment for a fresh start.

```bash
# 1. Environment and Cleanup
source ~/fdroid-tools/venv/bin/activate
rm -rf ~/coding/test/fdroid
mkdir -p ~/coding/test/fdroid
cd ~/coding/test/fdroid

# 2. Init and Config
fdroid init
sed -i 's|sdk_path: $ANDROID_HOME|sdk_path: /home/nathabee/Android/Sdk|' config.yml
sed -i 's|^# gradle:.*|gradle: /opt/gradle/gradle-8.13/bin/gradle|' config.yml

# Use tee to overwrite/set these cleanly
cat <<EOF >> config.yml
repo_url: http://192.168.178.27:8080/repo
repo_name: Nathabee Test Repo
repo_description: Freshly Recreated Server
lint_ignore:
    - UnknownCategory
    - NoNewLineAtEndOfFile
EOF

# 3. Ready for Metadata
mkdir -p metadata
echo "Server is reset. Now copy your .yml files to metadata/ and run builds."

```

---

#### Workflow 3: UPDATE APP IN EXISTING FDROIDSERVER

**Goal:** You’ve made a code change or bumped the version. You don't want to delete everything; you just want to pull the new code, build, and push the update to your phone.

```bash
# 1. Environment
source ~/fdroid-tools/venv/bin/activate
cd ~/coding/test/fdroid

# 2. Update Source Code
cd build/de.nathabee.beemage
git fetch --tags
git checkout v0.2.7-fdroid
cd ~/coding/test/fdroid

# 3. Sync Metadata
cp build/de.nathabee.beemage/apps/android-native/scripts/fdroid-template.yml metadata/de.nathabee.beemage.yml 
sed -i 's/\xc2\xa0/ /g' metadata/de.nathabee.beemage.yml

# --- THE FIX: FORCING THE BUILD ---
# Delete any previous versions of this specific build so F-Droid starts over
rm -f repo/de.nathabee.beemage_1002007.apk
rm -f unsigned/de.nathabee.beemage_1002007.apk

# 4. Build & Publish
# Now it should show "INFO: Building de.nathabee.beemage:1002007"
fdroid build -v -l --no-tarball de.nathabee.beemage
fdroid publish de.nathabee.beemage
fdroid update --create-metadata
```

---
 
## unit test on a android phone


You have two main ways to get this onto your phone:

### Method 1: The "Quick & Dirty" Way (ADB)

If your phone is plugged in with **USB Debugging** enabled, just push the signed APK directly. F-Droid puts the final signed files in the `repo/` directory of your test folder.

```bash
# From ~/coding/test/fdroid
adb install repo/de.nathabee.beemage_1002006.apk

```

---

### Method 2: The "Full F-Droid Experience" (Local Server)

If you want to see how it looks inside the F-Droid app on your phone, you can turn your computer into a temporary F-Droid repository.

**1. Generate the Repository Index**
F-Droid needs an `index.xml` (or `index-v1.jar`) so the phone app knows what apps are available.

```bash
# Update the repo index
fdroid update --create-metadata
# fdroid update --create-metadata --verbose
```

**2. Start a Local Web Server**
Python has a built-in server that is perfect for this:

```bash
cd repo
python3 -m http.server 8080

```

**3. Connect your Phone**

* Make sure your phone and computer are on the **same Wi-Fi**.
* Find your computer's local IP (usually `192.168.x.x`) using `hostname -I`.
* Open the **F-Droid app** on your phone.
* Go to **Settings > Repositories > + (Add)**.
* Enter the address: `http://<your-computer-ip>:8080`
* **Turn off "Fingerprint"** (since this is a local test repo) and click "Add".

---

### A Note on Signing Keys

Because you used a local test environment, F-Droid signed the APK with a **temporary auto-generated key** (`keystore.p12`).

> **Warning:** If you previously installed a version of BeeMage signed with your own developer key (or a different debug key), Android will refuse to install this F-Droid version due to a **"Signature Mismatch"**.
> You must **uninstall** any existing version of BeeMage from your phone before installing this one.

### Is the recipe ready for the MR?

Your recipe is looking great. The `gradle: - ""` hack is clever, but when you submit the MR to `fdroiddata`, a reviewer might ask you to change it to:

```yaml
    gradle:
      - yes
    gradletasks:
      - assembleRelease

```

(The official build server is more standardized than the local CLI). But for your local testing, **don't touch a thing**—it works!

Would you like me to help you verify the "Permissions" or "Features" that F-Droid detected in your APK before you send the MR?



