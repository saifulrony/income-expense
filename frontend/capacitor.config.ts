import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saiful.incomeexpense',
  appName: 'Income & Expense',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
};

export default config;

