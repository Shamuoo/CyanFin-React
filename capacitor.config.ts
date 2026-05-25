import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cyanfin.app',
  appName: 'CyanFin',
  webDir: 'server/public',
  server: {
    // Change this to your CyanFin server URL for production APK
    // For dev: comment out and use npx cap run android --livereload
    url: 'http://192.168.1.125:3002',
    cleartext: true, // Required for HTTP (non-HTTPS) Jellyfin servers
  },
  android: {
    // Android TV: set to true when building for TV
    allowMixedContent: true,
    captureInput: false,
    webContentsDebuggingEnabled: false,
    // TV-specific: overscan + large display handling
    initialFocus: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#080604',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
    },
  },
}

export default config
