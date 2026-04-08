import Constants from 'expo-constants';

interface AppConfig {
  apiUrl: string;
  environment: 'development' | 'production';
  enableLogs: boolean;
}

// ✅ Type-safe configuration
const config: AppConfig = {
  apiUrl: Constants.expoConfig?.extra?.apiUrl || 'https://api.thefixed.app/api',
  environment: Constants.expoConfig?.extra?.environment || 'development',
  enableLogs: Constants.expoConfig?.extra?.enableLogs ?? true,
};

// Intentionally no log at module load — use devLog() at call sites if needed

export default config;
