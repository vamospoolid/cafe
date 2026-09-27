import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codenusa.universalpos',
  appName: 'CodePOS Tablet',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    // When CAPACITOR_SERVER_URL is provided, APK dynamically loads the latest web app
    url: process.env.CAPACITOR_SERVER_URL || undefined,
    allowNavigation: ['*']
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a'
    }
  }
};

export default config;
