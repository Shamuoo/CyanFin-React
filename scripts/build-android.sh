#!/bin/bash
# CyanFin Android / Android TV APK builder
# Usage: ./scripts/build-android.sh [tv|phone]
set -e

TARGET="${1:-phone}"
echo "Building CyanFin Android APK — target: $TARGET"

# 1. Build web assets
npm run build

# 2. Sync to Capacitor Android project
npx cap sync android

# 3. TV-specific AndroidManifest tweaks
if [ "$TARGET" = "tv" ]; then
  MANIFEST="android/app/src/main/AndroidManifest.xml"
  # Add TV intent filter and LEANBACK_LAUNCHER
  if ! grep -q "LEANBACK_LAUNCHER" "$MANIFEST"; then
    sed -i 's|<intent-filter>|<intent-filter>\n            <action android:name="android.intent.action.MAIN"/>\n            <category android:name="android.intent.category.LEANBACK_LAUNCHER"/>\n        </intent-filter>\n        <intent-filter>|' "$MANIFEST"
    sed -i 's|uses-feature android:name="android.hardware.touchscreen"|uses-feature android:name="android.hardware.touchscreen" android:required="false"\n    <uses-feature android:name="android.software.leanback" android:required="true"|' "$MANIFEST"
    echo "✓ TV manifest configured"
  fi
fi

# 4. Build APK
cd android
./gradlew assembleDebug

echo ""
echo "APK location:"
find . -name "*.apk" -newer build.gradle 2>/dev/null | head -5
echo ""
echo "Install to connected device:"
echo "  adb install app/build/outputs/apk/debug/app-debug.apk"
