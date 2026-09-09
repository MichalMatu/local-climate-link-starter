import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'link.localclimate.app',
  appName: 'Local Climate Link',
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
