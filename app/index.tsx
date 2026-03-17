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

  // Redirect to the correct group directly — avoids a cross-navigator
  // replace in _layout.tsx that triggers "GO_BACK not handled" errors.
  if (user?.id) return <Redirect href="/(tabs)/dashboard" />;
  return <Redirect href="/(auth)/welcome" />;
}
