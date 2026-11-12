import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.ggarrote.squeeze',
  appName: 'Squeeze',
  webDir: 'build',
  backgroundColor: '#09090b',
  ios: { contentInset: 'automatic' },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_squeeze',
      iconColor: '#bef264',
      // The foreground timer owns on-screen sounds; native alerts own the background.
      presentationOptions: [],
    },
  },
};

export default config;
