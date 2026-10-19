# Cook-Off Android Apps

This directory contains the native Android wrapper applications for the **Cook-Off Contest** platform.

## Architecture

The project is structured as a multi-module Gradle project:

| Module | Target Device | Package | Primary Screen | Features |
| :--- | :--- | :--- | :--- | :--- |
| **`app-tv`** | Android TV / Google TV | `com.cookoff.tv` | `/view` | Leanback TV launcher banner, remote D-Pad navigation, Keep-Screen-On wake lock, hardware-accelerated animations |
| **`app-host`** | Android Phone / Tablet | `com.cookoff.host` | `/host` | Mobile host controls, native camera / image file upload chooser, responsive layout |

---

## Automated Builds via GitHub Actions

Every release tag (e.g. `v1.0.0`) or manual workflow dispatch ("Run workflow" in GitHub Actions tab) automatically compiles both applications and attaches the ready-to-install APK files directly to the GitHub Release:
- `CookOff-AndroidTV-ViewMode.apk`
- `CookOff-Host-Mobile.apk`

---

## How to Install on Android TV

You can easily install `CookOff-AndroidTV-ViewMode.apk` on any Google TV / Android TV device (e.g. Chromecast with Google TV, Xiaomi Mi Box / Stick, TCL / Sony TV, Nvidia Shield):

### Option 1: Via the "Downloader by AFTVnews" App (Easiest)
1. Install **Downloader** from the Google Play Store on your TV.
2. Open Downloader and enter the direct download URL of the APK from the GitHub Releases page (or use a URL shortener like bit.ly / tinyurl).
3. Click **Download** and then **Install**.

### Option 2: Via USB Drive
1. Download `CookOff-AndroidTV-ViewMode.apk` from GitHub Releases to a USB flash drive.
2. Plug the USB flash drive into your Android TV or TV Box.
3. Open any TV File Manager (e.g., *File Commander* or *FX File Explorer*) and install the APK.

### Option 3: Via ADB Sideload (Developers)
```bash
adb connect <TV_IP_ADDRESS>
adb install -r CookOff-AndroidTV-ViewMode.apk
```

---

## Local Compilation (Optional)

If you have JDK 17 installed:

```bash
cd android

# Build TV app APK
./gradlew :app-tv:assembleDebug

# Build Host app APK
./gradlew :app-host:assembleDebug
```

Outputs will be generated at:
- `android/app-tv/build/outputs/apk/debug/app-tv-debug.apk`
- `android/app-host/build/outputs/apk/debug/app-host-debug.apk`
