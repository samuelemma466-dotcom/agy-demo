# Android companion handoff

## Goal

Finish the native Omachy Android companion and verify it with a real phone over
the same Wi-Fi network or the phone hotspot. The immediate blocker is that the
installed app opens to a blank screen.

## Current project state

- Project: `/home/biggiesam/agy-demo`, branch `feature/standalone-suite`.
- The repository already contains many user changes and untracked files. Preserve
  all of them, including `server/__pycache__/phone_transfer.cpython-314.pyc`.
- Desktop protocol: `docs/phone-protocol-v1.md` and
  `server/phone_transfer.py`.
- Desktop pairing UI: `src/apps/ConnectApp.tsx`; Drop UI:
  `src/apps/DropApp.tsx` and `src/components/transfers/TransferPanel.tsx`.
- Android project: `android/`.
- Android Activity: `android/app/src/main/java/com/omachy/connect/MainActivity.java`.
- TLS and transfer client: `android/app/src/main/java/com/omachy/connect/PhoneProtocolClient.java`.
- Android SDK Platform 36 and Build Tools 36.0.0 are installed. Java 21 and
  Gradle 9.8.1 are installed. Build with
  `cd /home/biggiesam/agy-demo/android && gradle --no-daemon assembleDebug`.
- The debug APK built successfully at
  `android/app/build/outputs/apk/debug/app-debug.apk` (package
  `com.omachy.connect`, version `0.1.0`, min Android 8.0). Its APK signature
  verified.

## Phone symptom

The user installed and opened the APK, but reports that it displays a blank
screen. We restarted it with:

```bash
adb shell am force-stop com.omachy.connect
adb shell monkey -p com.omachy.connect 1
sleep 2
adb logcat -d -t 400 -s AndroidRuntime:E System.err:E
```

The command produced no runtime errors. The Codex sandbox cannot access USB or
the user's ADB server, so obtain phone diagnostics from the user's desktop
terminal. Ask for a screenshot or inspect the resumed Activity and app process.
Do not assume the desktop pairing service is running.

## Next work

1. Diagnose why `MainActivity.buildUi()` is not visibly rendering on this phone.
   Check device model/Android version, the installed APK version, resumed
   Activity, and a screenshot. Add only a focused fix.
2. Build again, install with
   `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`, and
   confirm the first screen renders.
3. Start a five-minute desktop Connect session, scan its QR on the phone,
   approve the phone on desktop, and verify `/v1/ping` succeeds.
4. Test a small file in each direction and verify byte progress and SHA-256.
5. Report separately what compiled, what ran, what was tested on a real device,
   and any remaining limitations.

Do not install more packages, use `sudo`, change desktop/system settings, or
discard project work without discussing it with the user. The AI Agents Map
plugin can launch a new Codex terminal session, but it cannot attach to this
ChatGPT conversation; use this handoff file as its starting context.
