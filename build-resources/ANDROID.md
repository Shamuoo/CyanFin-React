# CyanFin Android / Android TV Build Guide

## Prerequisites

1. Android Studio installed (includes SDK + Gradle)
2. Java 17+ (`java -version`)
3. `ANDROID_HOME` env var set to SDK path
4. For physical device: USB debugging enabled

## First-time setup

```bash
# Install Capacitor Android platform (only once)
npm install @capacitor/android @capacitor/splash-screen @capacitor/keyboard
npx cap add android
```

## Building

### Android Phone APK
```bash
npm run android:phone
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Android TV APK
```bash
npm run android:tv
# APK same path — install via ADB or sideload
```

### Open in Android Studio
```bash
npm run android:open
```

## Configuration

Edit `capacitor.config.ts`:
- Change `server.url` to your CyanFin server IP
- For HTTPS Jellyfin: remove `cleartext: true`

## Sideloading to Fire TV / Android TV

```bash
# Enable ADB on your TV (Settings → Device → Developer Options)
adb connect <TV_IP>:5555
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## D-pad navigation

CyanFin's TV layout + D-pad navigation (directional scoring algorithm) is
already implemented in `src/hooks/useDpadNavigation.ts`.

The layout auto-detects Android TV via user-agent in `src/hooks/useDevice.ts`.

## Release build (Play Store)

1. Generate a keystore: `keytool -genkey -v -keystore cyanfin.jks ...`
2. Configure signing in `android/app/build.gradle`
3. Run `./gradlew bundleRelease` from the `android/` directory
