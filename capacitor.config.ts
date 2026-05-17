import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cyanfin.app',
  appName: 'CyanFin',
  webDir: 'server/public',
  server: {
    // Change to your CyanFin server IP — same machine or another Unraid box
    url: 'http://192.168.1.125:3002',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#080604',
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    backgroundColor: '#080604',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#080604',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#080604',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
  },
};

export default config;
