import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.shellylink.mobile',
  appName: 'Shelly Link',
  webDir: 'dist',
  android: {
    adjustMarginsForEdgeToEdge: 'auto'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
