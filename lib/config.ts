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

// Log en dev uniquement
if (__DEV__ && config.enableLogs) {
  console.log('🔧 App Configuration:', {
    apiUrl: config.apiUrl,
    environment: config.environment,
  });
}

export default config;
