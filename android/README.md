# Omachy Connect for Android

This is the first native Android companion for Omachy protocol v1. It targets
Android 8.0 (API 26) and newer. It pairs by scanning the desktop QR, verifies
the exact TLS certificate SHA-256 fingerprint carried by that QR, waits for
desktop approval, and then supports phone-to-desktop and desktop-to-phone file
offers using Android's document picker. Each completed transfer is checked
against SHA-256 before being reported as complete.

## Current limitations

- Pairing credentials are held in memory only. The desktop session and its
  credentials expire when the five-minute session ends; pair again for a new
  session.
- Keep this app open during transfers. The screen stays awake while bytes are
  moving, but transfers are not a background service and can stop if Android
  kills the app.
- QR scanning uses Google Play services' code scanner. On first use, Google
  Play services may need internet to download its scanner module. A paste field
  is included as a fallback.
- The debug APK now builds successfully on this machine. It has not yet been
  installed or tested on a real Android device, so phone pairing and file
  transfers remain unverified.
- Hotspot routing depends on the phone model. The phone must be able to reach
  the connected computer's selected local IPv4 address.

## Build requirements

- JDK 17 or newer (JDK 21 is fine).
- Gradle 9.6 or newer for Android Gradle Plugin 9.5.0.
- Android SDK Platform 36 and Build Tools 36.0.0.
- Android Platform Tools (`adb`) to install and inspect the APK over USB.

The emulator is not required; deploy to a physical Android phone to avoid its
large download and memory use.

After installing the Android command-line tools and accepting their SDK
licenses, build with:

```bash
cd /home/biggiesam/agy-demo/android
gradle --no-daemon assembleDebug
```

The debug APK is written to:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Install over USB after enabling Developer options and USB debugging on the
phone:

```bash
adb devices -l
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The Android SDK packages can be installed with Google's SDK Manager. The SDK
Manager can show the download sizes before installing the API 35 platform and
build tools. Do not install an emulator or NDK for this app.

## Pair and transfer

1. Connect the phone and computer to the same Wi-Fi network, or enable the
   phone hotspot and connect the computer to it.
2. Start a temporary session in desktop Omachy Connect and select the
   computer's address on that network.
3. Scan its QR in this app. If scanning is unavailable, paste the QR text.
4. Approve the phone in Omachy Connect on the computer.
5. To send a phone file, choose it here and approve it in desktop Omachy Drop.
   To receive a file, choose a save location here and accept its offer.
6. Keep the app open until the SHA-256 check and completion response finish.

Transfers use TLS 1.2 or newer with a certificate fingerprint pin, a temporary
pairing token, and a separate one-time device credential. The app does not
trust arbitrary certificates or follow redirects.
