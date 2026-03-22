import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

export default function Index() {
  const { user, isBooting } = useAuth();
  const theme = useAppTheme();

  if (isBooting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // No user → welcome
  if (!user?.id) return <Redirect href="/(auth)/welcome" />;

  // Email not verified → verification screen
  if (user.emailVerified === false) {
    return <Redirect href={{ pathname: "/(auth)/verify-email", params: { email: user.email } }} />;
  }

  // Provider not yet active → pending screen
  const isProvider = user.roles?.includes('PROVIDER');
  if (isProvider) {
    if (user.providerStatus === 'ACTIVE') {
      return <Redirect href="/(tabs)/provider-dashboard" />;
    }
    return <Redirect href="/onboarding/provider/pending" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
