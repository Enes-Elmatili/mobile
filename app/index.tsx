import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth/AuthContext';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { user, isBooting } = useAuth();

  if (isBooting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' }}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  // Redirect to the correct group directly — avoids a cross-navigator
  // replace in _layout.tsx that triggers "GO_BACK not handled" errors.
  if (user?.id) return <Redirect href="/(tabs)/dashboard" />;
  return <Redirect href="/(auth)/welcome" />;
}
