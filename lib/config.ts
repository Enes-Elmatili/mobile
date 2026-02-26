import Constants from 'expo-constants';

interface AppConfig {
  apiUrl: string;
  socketUrl: string;
  stripePublishableKey: string;
  environment: 'development' | 'production';
  enableLogs: boolean;
}

const config: AppConfig = {
  apiUrl: Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api',
  socketUrl: Constants.expoConfig?.extra?.socketUrl || 'http://localhost:3000',
  stripePublishableKey: Constants.expoConfig?.extra?.stripePublishableKey || '',
  environment: Constants.expoConfig?.extra?.environment || 'development',
  enableLogs: Constants.expoConfig?.extra?.enableLogs ?? true,
};

if (__DEV__ && config.enableLogs) {
  console.log('🔧 App Configuration:', {
    apiUrl: config.apiUrl,
    socketUrl: config.socketUrl,
    environment: config.environment,
  });
}

export default config;
